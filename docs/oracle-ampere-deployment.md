# Oracle Ampere Deployment — arm64 Self-Hosted Stack

How to run the application on an Oracle Cloud Infrastructure **Ampere A1**
(`VM.Standard.A1.Flex`) instance using the container assets in `deploy/`, as an
alternative to the Vercel topology in `docs/deployment.md` and the x86 Kamatera
topology in `docs/kamatera-deployment.md`.

Audience: someone provisioning a fresh A1 instance for the
`DEPLOY_TARGET=self-hosted` profile, or rebuilding one.

> **This repository is public.** Every credential, IP address, and domain name
> below is a placeholder — `<password>`, `<instance-public-ip>`, `<domain>`.
> Never commit real values. The filled-in `deploy/.env.selfhost` is
> git-ignored; keep it that way.

This guide is the arm64 corner of the same provider matrix
`docs/kamatera-deployment.md` describes. The compose topology is deliberately
the same shape — app, Postgres, Redis and MinIO on `127.0.0.1`, a single public
reverse proxy — so that only the host-specific parts below differ.

---

## 1. The A1 shape and what arm64 changes

`VM.Standard.A1.Flex` is an Ampere Altra instance: **`aarch64`/`arm64`, not
x86_64**. Oracle's always-free allocation is 4 OCPUs and 24 GB of RAM, which
can be taken as one 4-OCPU instance or split across up to four.

What this means in practice:

- **Every image in the stack must have an arm64 variant.** `postgres:16-alpine`,
  `redis:7-alpine`, `caddy:2-alpine`, and `minio/minio` all publish
  `linux/arm64` — the compose stack in `deploy/docker-compose.yml` needs no
  per-architecture changes.
- **The application image must be built for arm64.**
  `.github/workflows/deploy-selfhost.yml` does this on the GitHub-hosted
  `ubuntu-24.04-arm` runner, where the build is **native**. That workflow is
  the arm64 gate; it is the only place arm64 is validated.
- **Do not build arm64 under QEMU emulation.** `docker buildx build
--platform linux/arm64` on an x86 machine works but is roughly an order of
  magnitude slower with this codebase — `reactCompiler: true` plus Turbopack
  measured at `npm ci` 35s → 262s and the Next.js compile 35s → 7.5 minutes.
  A native `docker build` on an x86 machine is still useful: it validates the
  Dockerfile's own correctness (stage graph, copied paths, standalone output)
  in about 70 seconds. It does **not** validate arm64. Only the workflow does.
- **Native dependencies.** `node_modules` is excluded by `.dockerignore`, so
  the image never inherits x86 prebuilt binaries from a developer's checkout —
  `npm ci` runs inside the arm64 build and fetches the right ones.

---

## 2. Networking: the double gate

**This is the single most common way an A1 instance appears broken.** Oracle
puts two independent firewalls in front of the instance and both must allow a
port. Opening only one leaves connections timing out with no error anywhere
obvious.

### Gate 1 — the VCN Security List (or Network Security Group)

In the OCI console: **Networking → Virtual Cloud Networks → _your VCN_ →
Security Lists → Default Security List**. Add ingress rules:

| Source      | Protocol | Destination port | Purpose                          |
| ----------- | -------- | ---------------- | -------------------------------- |
| `0.0.0.0/0` | TCP      | 80               | Let's Encrypt HTTP-01 + redirect |
| `0.0.0.0/0` | TCP      | 443              | HTTPS                            |
| `<your-ip>` | TCP      | 22               | SSH — narrow this to your own IP |

Leave every other port closed. Postgres, Redis, and MinIO are on loopback and
must never be reachable from the internet.

### Gate 2 — the instance's local `iptables`

Oracle's Ubuntu images ship with a local firewall that **drops everything
except port 22**, and it is applied before anything you configured in the VCN
takes effect. A correct Security List on its own still times out.

Insert the rules ahead of the catch-all `REJECT`:

```bash
# Inspect the chain first; note the rule numbers of the trailing REJECT rules.
sudo iptables -L INPUT --line-numbers -n

# Insert before them (adjust `6` to the line number of the first REJECT).
sudo iptables -I INPUT 6 -p tcp --dport 80 -m state --state NEW -j ACCEPT
sudo iptables -I INPUT 6 -p tcp --dport 443 -m state --state NEW -j ACCEPT

# Verify the ACCEPT rules now precede the REJECT rules.
sudo iptables -L INPUT --line-numbers -n
```

`iptables` rules do not survive a reboot on their own. Persist them:

<!-- doc-drift-ignore-next-block --> third-party package commands, not project scripts

```bash
sudo apt-get update && sudo apt-get install -y iptables-persistent
sudo netfilter-persistent save
```

If the instance uses `firewalld` instead (some Oracle Linux images do):

<!-- doc-drift-ignore-next-block --> third-party firewalld commands

```bash
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

**Verify both gates from outside the instance**, not from a shell on it:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' http://<domain>/
```

A connection timeout means a gate is still closed. A refused connection means
the gates are open and nothing is listening.

### Egress: the 10 TB/month cap

Oracle's always-free tier includes **10 TB of outbound data transfer per
month**; beyond it, egress is billed. Product imagery is the realistic way to
exceed that.

Front the origin with Cloudflare (free plan is sufficient):

- Point the domain's DNS at Cloudflare and enable proxying (orange cloud) for
  the app record. Cached responses are then served from Cloudflare's edge and
  never touch the instance's egress budget.
- Keep the Cloudflare SSL/TLS mode on **Full (strict)** so the hop to the
  instance stays encrypted against the Let's Encrypt certificate Caddy holds.
- Cloudflare must still be able to reach `:80` for the HTTP-01 challenge on
  renewal, so do not close gate 1 or gate 2 afterwards.
- Images are already resized by the `workers/images` Cloudflare Worker, so the
  bytes the instance serves are the originals only — see section 5.

---

## 3. Provisioning

```bash
ssh ubuntu@<instance-public-ip>

# Docker Engine + the compose plugin, arm64 build.
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER" && newgrp docker

# The repository is only needed for deploy/ — the app itself ships as an image.
git clone <repository-url> ~/octo && cd ~/octo/deploy

cp .env.selfhost.example .env.selfhost
chmod 600 .env.selfhost
"$EDITOR" .env.selfhost           # fill in real values

docker compose pull
docker compose up -d
docker compose ps
```

Apply migrations from a machine that can reach the database — the image runs
the server only, it does not migrate:

```bash
npm run db:migrate
```

`db:migrate` creates schema and inserts no rows. There is no sample-data
seeding, so a fresh database starts empty and the first products are created
through the admin UI.

---

## 4. Build-time `DATABASE_URL` (read before building a production image)

`generateStaticParams` in `src/app/(public)/products/[id]/page.tsx` queries the
catalog at build time to decide which product pages to prerender; the shop
route reads bestsellers and the category taxonomy for the same reason.

Those reads **degrade gracefully** when the database is unreachable. The build
completes and logs, under the `product_static_params` and
`shop_bestsellers_fetch` contexts:

```text
Failed query: select "id", "name" from "Category" ...
   [cause]: Error: getaddrinfo ENOTFOUND BUILD_TIME_PLACEHOLDER_DO_NOT_USE
```

That degradation is correct and must not be suppressed — a build machine
legitimately holds no runtime credentials, and the same code path is what keeps
CI smoke builds working. But the consequence is concrete:

> An image built without a reachable `DATABASE_URL` contains **zero prerendered
> product pages**. `/products/[id]` collapses to a single
> `/products/__no_products__` entry, and every real product URL falls back to
> on-demand rendering on its first request — a cold database query and a full
> server render in the visitor's critical path.

Acceptable for a CI smoke build. Wrong for an image serving traffic.

To build a fully prerendered image, pass a reachable connection string. A
read-only role is enough; nothing at build time writes.

```bash
docker build --build-arg DATABASE_URL="postgresql://<user>:<password>@<host>:5432/<db>" \
  -t <image>:<tag> .
```

In CI, set the `DATABASE_URL` repository secret and run
`.github/workflows/deploy-selfhost.yml` with its `prerender_catalog` input
enabled. With the input off, the workflow annotates the run with a warning that
the published image is a smoke image.

---

## 5. Environment

`deploy/.env.selfhost.example` is the authoritative, commented list. Every
selection resolves through `src/lib/providers/resolution.ts` — the only module
that chooses a backend. Precedence: explicit selector → credential inference →
`DEPLOY_TARGET` preset → hardcoded default. The preset can never override a
selector.

| Variable                       | Value             | Note                                                                                |
| ------------------------------ | ----------------- | ----------------------------------------------------------------------------------- |
| `DEPLOY_TARGET`                | `self-hosted`     | Presets storage/config/deferred/analytics/jobs; also enables `output: 'standalone'` |
| `DATABASE_DRIVER`              | `postgres`        | See below                                                                           |
| `DATABASE_URL`                 | loopback Postgres | `READ_DATABASE_URL` optional, falls back to this                                    |
| `CACHE_PROVIDER` / `REDIS_URL` | `redis`           | Required for the shared Cache Components handler                                    |
| `RATE_LIMIT_PROVIDER`          | `redis`           | `memory` counts per process, so limits are per instance                             |
| `SEARCH_PROVIDER`              | `postgres`        | SQL fallback against the same database, no extra service                            |
| `STORAGE_PROVIDER`             | `s3`              | MinIO is the S3 adapter pointed at a self-hosted endpoint                           |
| `CONFIG_PROVIDER`              | `environment`     | No Edge Config off Vercel                                                           |
| `DEFERRED_PROVIDER`            | `process`         | No `waitUntil` off Vercel                                                           |
| `JOBS_PROVIDER`                | `inline`          | Set `inngest` only if Inngest is actually reachable                                 |
| `ANALYTICS_PROVIDER`           | `none`            | Vercel Analytics has no self-hosted equivalent                                      |

Check what the running instance actually resolved with `GET /api/health`. It
always returns 200; a `status` of `degraded` means an explicitly selected
provider is missing a credential.

### `DATABASE_DRIVER=postgres`, not `neon`

Use the `pg` pool. The Neon HTTP driver exists for serverless runtimes that
cannot hold a socket across invocations — it pays a TLS handshake and an HTTP
round trip per query, and gives up connection reuse and prepared statements to
do it. A container that runs for weeks has none of those constraints, so the
HTTP driver is strictly worse there. Keep
`DATABASE_POOL_MAX_LIFETIME_SECONDS` below any pooler's `server_idle_timeout`
so the client retires a socket before the server does.

### `AUTH_URL` / `NEXTAUTH_URL` behind the proxy

Set both explicitly to the public origin, and set `AUTH_TRUST_HOST=true`:

```bash
AUTH_TRUST_HOST=true
AUTH_URL=https://<domain>
NEXTAUTH_URL=https://<domain>
NEXT_PUBLIC_BASE_URL=https://<domain>
```

Behind a reverse proxy the app sees a request for `127.0.0.1:3000`. Without
`AUTH_TRUST_HOST` Auth.js refuses to build callback URLs from the forwarded
host, so OAuth redirects are constructed against the loopback origin and the
provider rejects them. `deploy/Caddyfile` forwards `X-Forwarded-Proto`,
`X-Forwarded-Host`, and `X-Real-IP` for this reason — the two halves only work
together.

### Image Worker hostname allow-list

`next.config.ts` uses a custom image loader (`src/lib/image-loader.ts`) that
routes through the `workers/images` Cloudflare Worker, so
`images.remotePatterns` does not apply — the allow-list lives in the Worker.
Add the new origin to **every** `[env.<name>.vars]` block in
`workers/images/wrangler.toml`, because wrangler does not inherit top-level
`[vars]` into named environments:

```toml
ALLOWED_HOSTNAMES = "images.unsplash.com,lh3.googleusercontent.com,.public.blob.vercel-storage.com,.r2.dev,<domain>"
```

Without this the Worker rejects every resize for images served from the new
origin. Deploying the change is `.github/workflows/deploy-images-worker.yml`.

---

## 6. Reverse proxy and TLS

`deploy/Caddyfile` provisions and renews a Let's Encrypt certificate
automatically and redirects http → https. It is the only public listener;
everything else is on loopback.

It deliberately sets **no** security headers. `next.config.ts` already emits
`Strict-Transport-Security`, `Referrer-Policy`, and `Permissions-Policy` on
every response, and duplicating them is not additive — a user agent that sees
`Strict-Transport-Security` more than once is required to ignore it entirely,
so a well-meaning duplicate silently disables HSTS. Change these in
`next.config.ts` only.

---

## 7. systemd instead of Compose

`deploy/systemd/` holds units for running the standalone server and Caddy
directly. Pick one process model — units _or_ Compose — and do not mix them.

Both units read secrets from an `EnvironmentFile` (a root-owned `0600` file
outside the unit) rather than inline `Environment=` lines, which are
world-readable through `systemctl show`.

**Cache invalidation caveat.** `revalidateTag` only affects the process that
received the request unless Next.js is using the shared Redis cache handler.
`next.config.ts` wires up `src/lib/cache-handler.ts` only when
`DEPLOY_TARGET=self-hosted` **and** the `cache` capability resolves specifically
to `redis`. Run more than one copy of the app without that and each process
serves its own stale entry until its `cacheLife` expiry. On a single instance
the default in-memory handler is exactly right and this does not apply.

---

## 8. Operations

```bash
docker compose logs -f app          # application logs (Pino JSON)
docker compose ps                   # container health
curl -s https://<domain>/api/health # provider readiness
curl -s https://<domain>/api/metrics # Prometheus metrics
```

Back up the `pgdata` and `miniodata` volumes off-instance —
`docs/self-hosting.md` describes the systemd-timer + OCI Object Storage
approach used for the database tier.

---

## Related

- [`docs/deployment.md`](./deployment.md) — provider resolution, `DEPLOY_TARGET` presets, migrations
- [`docs/kamatera-deployment.md`](./kamatera-deployment.md) — the same topology on an x86 VM with Nginx
- [`docs/self-hosting.md`](./self-hosting.md) — self-hosted Postgres + PgBouncer and the backup runbook
- [`docs/observability.md`](./observability.md) — logs, metrics, health endpoint
