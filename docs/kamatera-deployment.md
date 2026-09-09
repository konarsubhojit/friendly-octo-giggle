# Kamatera Deployment — Full Self-Hosted Stack

How to run the **entire** application self-hosted on a single Kamatera VM —
Next.js behind Nginx, PostgreSQL, Redis, MinIO (S3-compatible object storage),
and PostgreSQL-backed search — as an alternative to the Vercel + managed
Postgres/PgBouncer topology described in `docs/self-hosting.md`.

Audience: someone provisioning a fresh Kamatera VM for the self-hosted
provider profile, or the maintainer rebuilding one after losing it.

> **This repository is public.** Every credential, IP address, and domain name
> below is a placeholder — `<password>`, `<vm-public-ip>`, `<domain>`. Never
> commit real values.

This guide is the "self-hosted" corner of the provider matrix in
`src/lib/providers/resolution.ts`: every capability below is selected the same
way in code regardless of host (`DATABASE_DRIVER=postgres`,
`CACHE_PROVIDER=redis`, `STORAGE_PROVIDER=s3`, `SEARCH_PROVIDER=postgres`) —
only the environment variables pointing at *this* VM's services differ from
the managed-provider profiles documented in `docs/deployment.md`.

---

## Architecture

```text
Internet
   │  :443 (TLS)
   ▼
┌────────────────────────────────────────────────────────────────────┐
│ Kamatera VM                                                        │
│                                                                    │
│  ┌────────────┐   127.0.0.1:3000   ┌──────────────────────────┐   │
│  │   Nginx    │───────────────────▶│  Next.js (systemd unit    │   │
│  │ TLS term.  │                    │  or `app` compose service) │   │
│  │ :80 → :443 │                    └──────────────────────────┘   │
│  └────────────┘                          │        │        │       │
│                                           ▼        ▼        ▼       │
│                                    127.0.0.1  127.0.0.1  127.0.0.1  │
│                                     :5432      :6379      :9000    │
│                              ┌──────────┐ ┌────────┐ ┌───────────┐│
│                              │ postgres │ │ redis  │ │  minio    ││
│                              │  :16     │ │  :7    │ │ (S3 API)  ││
│                              └──────────┘ └────────┘ └───────────┘│
│                                                                    │
│  cron ── nightly `pg_dump` + MinIO object sync ──▶ off-VM storage  │
└────────────────────────────────────────────────────────────────────┘
```

| Component      | Detail                                                              |
| -------------- | -------------------------------------------------------------------- |
| Reverse proxy  | Nginx, terminates TLS, proxies to Next.js on loopback                |
| App            | Next.js production build (`npm run build && npm run start`)         |
| Database       | `postgres:16-alpine` (or `18-alpine`, matching `docs/self-hosting.md`), bound to `127.0.0.1:5432` |
| Cache          | `redis:7-alpine`, bound to `127.0.0.1:6379`                          |
| Object storage | `minio/minio`, bound to `127.0.0.1:9000`, S3 API only reachable through the app |
| Search         | `SEARCH_PROVIDER=postgres` — no extra service, queries the same database |
| Process model  | systemd units *or* a single Docker Compose stack — pick one, do not mix |

Every service except Nginx is bound to loopback only (`127.0.0.1:<port>`) —
**private port bindings**, not published to the VM's public interface. Nginx
is the only process with a public listener (`:80`/`:443`). This is the same
"pooler/proxy is the only public surface" shape as `docs/self-hosting.md`'s
PgBouncer, applied to the whole stack.

### Resource limits

Kamatera VMs are billed by a fixed vCPU/RAM/disk plan, so every service needs
an explicit memory ceiling — an unbounded container competing with the app for
RAM under load is the most common cause of an OOM-killed Postgres on small
plans. Minimums for the smallest viable plan (2 vCPU / 4 GB RAM):

| Service    | Memory limit | Notes                                                          |
| ---------- | ------------ | --------------------------------------------------------------- |
| postgres   | 1024m        | `shared_buffers` should be ~25% of this, not the VM's total RAM |
| redis      | 256m         | Set `maxmemory 200mb` and `maxmemory-policy allkeys-lru` — Redis here is cache/mirror data only, never authoritative (see below) |
| minio      | 512m         | Object bodies stream through, not buffered in full              |
| Next.js    | remaining    | Size to what's left after the above plus OS overhead            |

If using Compose, set these as `deploy.resources.limits.memory` (Compose v2)
or `mem_limit` (classic); if using systemd, set `MemoryMax=` in each unit.

---

## Config files

All paths are on the VM. Nothing here lives in this repository.

### `~/docker/docker-compose.app.yml`

```yaml
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: octo
      POSTGRES_PASSWORD: <password>
      POSTGRES_DB: octo
    ports:
      - '127.0.0.1:5432:5432' # loopback only — private port binding
    volumes:
      - pgdata:/var/lib/postgresql/data
    mem_limit: 1024m

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: >
      redis-server --maxmemory 200mb --maxmemory-policy allkeys-lru
      --save 60 1000
    ports:
      - '127.0.0.1:6379:6379' # loopback only
    volumes:
      - redisdata:/data
    mem_limit: 256m

  minio:
    image: minio/minio
    restart: unless-stopped
    command: server /data --console-address :9001
    environment:
      MINIO_ROOT_USER: <minio-user>
      MINIO_ROOT_PASSWORD: <minio-password>
    ports:
      - '127.0.0.1:9000:9000' # S3 API — loopback only, the app is the only client
      - '127.0.0.1:9001:9001' # web console — tunnel over SSH to reach it, never publish
    volumes:
      - miniodata:/data
    mem_limit: 512m

volumes:
  pgdata:
  redisdata:
  miniodata:
```

Bring up: `docker compose -f ~/docker/docker-compose.app.yml up -d`. The app
itself runs outside this compose file (see the systemd unit below) so that
`npm run build` failures don't take the data tier down with a `restart`
policy flapping the whole stack.

### `/etc/systemd/system/octo-app.service`

Running the Next.js process under systemd (rather than in Compose) keeps
build/deploy failures isolated from the data services above, and gives
`journalctl` as the log sink instead of `docker logs`:

```ini
[Unit]
Description=Next.js storefront
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=octo
WorkingDirectory=/home/octo/app
EnvironmentFile=/home/octo/app/.env.production
ExecStart=/usr/bin/npm run start
Restart=on-failure
RestartSec=5
MemoryMax=2048M

[Install]
WantedBy=multi-user.target
```

`After=... Requires=docker.service` is the VM-restart ordering guarantee: the
app unit will not start until Docker (and therefore the compose stack above,
if it has its own `enabled` systemd-managed compose unit or is started via a
`docker compose up -d` in a separate boot unit) has had a chance to start.
Postgres/Redis/MinIO still need their own startup health checks before the
app can serve traffic — see "VM restart" below.

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now octo-app.service
```

### `/etc/nginx/sites-available/octo`

```nginx
server {
    listen 80;
    server_name <domain>;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name <domain>;

    ssl_certificate     /etc/letsencrypt/live/<domain>/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/<domain>/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/octo /etc/nginx/sites-enabled/
sudo certbot --nginx -d <domain>
sudo nginx -t && sudo systemctl reload nginx
```

### Environment (`/home/octo/app/.env.production`)

```bash
DATABASE_URL=postgresql://octo:<password>@127.0.0.1:5432/octo
DATABASE_DRIVER=postgres

CACHE_PROVIDER=redis
REDIS_URL=redis://127.0.0.1:6379

STORAGE_PROVIDER=s3
S3_ENDPOINT=http://127.0.0.1:9000
S3_FORCE_PATH_STYLE=true
S3_REGION=us-east-1
S3_BUCKET=octo-uploads
S3_ACCESS_KEY_ID=<minio-user>
S3_SECRET_ACCESS_KEY=<minio-password>
S3_PUBLIC_BASE_URL=https://<domain>/uploads # served by an Nginx location block proxying MinIO, not exposed directly

SEARCH_PROVIDER=postgres

NEXTAUTH_URL=https://<domain>
NEXTAUTH_SECRET=<secret>
```

`STORAGE_PROVIDER=s3` with `S3_ENDPOINT` + `S3_FORCE_PATH_STYLE=true` is the
same MinIO-compatible path used by the CI provider-matrix job and the S3
adapter's own tests (`__tests__/lib/storage/s3.test.ts`) — this is not a
separate "MinIO adapter", it is the S3 adapter pointed at a self-hosted
endpoint. See `docs/deployment.md`'s "Provider selection" section for the
full precedence rules and every variable name.

---

## Backups and restore drills

**PostgreSQL and object storage are the authoritative state and must be
backed up off-VM.** Redis here is configured as cache/mirror data only
(rate-limit counters, cached query results) — nothing is written to Redis
that cannot be regenerated from Postgres, so Redis itself is treated as
disposable and is *not* part of the backup set. If a deployment ever stores
anything authoritative in Redis (e.g. a queue with no durable source of
truth), that data must be moved to Postgres or backed up separately before
this guidance applies to it.

```bash
#!/usr/bin/env bash
set -euo pipefail

STAMP=$(date +%F)
BACKUP_DIR=~/backups

# Postgres: logical dump, matches the restore drill in docs/self-hosting.md.
docker exec octo-postgres-1 pg_dump -U octo -Fc octo > "$BACKUP_DIR/octo-$STAMP.dump"

# Object storage: mirror the bucket, not just list it — `mc mirror` only
# copies new/changed objects on each run.
docker run --rm --network host \
  -e MC_HOST_local="http://<minio-user>:<minio-password>@127.0.0.1:9000" \
  minio/mc mirror local/octo-uploads "$BACKUP_DIR/uploads-$STAMP/"

# Ship both off the VM — rsync/rclone to remote storage, not shown here.
find "$BACKUP_DIR" -mtime +14 -delete
```

### Verifying a restore

> An unverified backup is not a backup — run this drill, don't just schedule
> the cron job above and assume it works.

```bash
# Postgres — same drill as docs/self-hosting.md, against a scratch database.
docker exec -i octo-postgres-1 psql -U octo -d postgres -c 'CREATE DATABASE octo_restore_test;'
docker exec -i octo-postgres-1 pg_restore -U octo -d octo_restore_test --no-owner \
  < ~/backups/octo-<stamp>.dump
docker exec -i octo-postgres-1 psql -U octo -d octo_restore_test -c 'SELECT count(*) FROM "Product";'
docker exec -i octo-postgres-1 psql -U octo -d postgres -c 'DROP DATABASE octo_restore_test;'

# Object storage — restore into a scratch bucket, verify object count, remove it.
docker run --rm --network host \
  -e MC_HOST_local="http://<minio-user>:<minio-password>@127.0.0.1:9000" \
  minio/mc mb local/octo-restore-test
docker run --rm --network host -v ~/backups/uploads-<stamp>:/src \
  -e MC_HOST_local="http://<minio-user>:<minio-password>@127.0.0.1:9000" \
  minio/mc mirror /src local/octo-restore-test
docker run --rm --network host \
  -e MC_HOST_local="http://<minio-user>:<minio-password>@127.0.0.1:9000" \
  minio/mc rb --force local/octo-restore-test
```

---

## Failure drills

| Scenario                             | Expected behavior                                                                                     |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Postgres down at startup              | Next.js starts (there is no startup DB probe), but every request touching the database fails until Postgres is reachable; systemd `Restart=on-failure` only restarts the *app* process, which will not help — resolve Postgres first |
| Postgres down mid-request             | In-flight requests touching the database fail and surface as 5xx; no credential is present in the error response or logs |
| Redis down, slow, or recovering       | Reads fall back to the database on a cache miss — no user-facing failure, only latency; see `getCachedData` in `src/lib/redis.ts` |
| MinIO down during upload              | Admin upload fails with a surfaced error; already-served images remain available if CDN/browser-cached, new uploads must be retried once MinIO recovers |
| MinIO down during read resolution     | `resolveStorageUrl` cannot resolve new asset URLs; existing pages referencing already-resolved URLs are unaffected until next render |
| Invalid/partial credentials           | `getProviderSummary()` (surfaced at `/api/health`) reports the capability as `degraded` with a non-secret diagnostic, but only when a provider was *explicitly* selected without the credentials it needs — an inferred/defaulted provider never produces this, see `src/lib/providers/resolution.ts`. `/api/health` is a configuration check, not a live connectivity probe: it does not detect "Postgres is down right now" by itself |
| Search provider unavailable/failing/rate-limited | `searchProductIds` catches the failure, emits the structured `provider_fallback` event (`src/lib/providers/events.ts`), and returns `null` so the caller falls back to the database `ILIKE` query — no user-facing failure |
| VM restart                            | systemd unit ordering (`After=`/`Requires=docker.service`) plus Docker's own `restart: unless-stopped` bring services back without manual intervention; verify with `docker compose ps` and `systemctl status octo-app` after every reboot, and confirm named volumes (`pgdata`, `redisdata`, `miniodata`) survived |

Run each drill against a disposable or staging Kamatera VM before relying on
this document for a production incident — this table describes the intended
behavior, it does not substitute for having exercised it.

---

## Upgrades

1. Take a verified backup (see above) before touching anything.
2. `git pull`, `npm ci`, `npm run build` locally or in CI — never build on the
   production VM with the app already serving traffic from the same
   directory.
3. Run `npm run db:migrate` against the VM's Postgres **before** deploying the
   new build (expand/contract discipline — see `docs/deployment.md`'s
   "Database Migrations" section; the currently running old code must keep
   working against the new schema until the new code is live).
4. Ship the new build to the VM, `sudo systemctl restart octo-app.service`.
5. Watch `/api/health` and `journalctl -u octo-app -f` for the first few
   minutes; roll back by restarting the previous build if the new one is
   unhealthy — the database migration should already be backward-compatible
   per step 3, so a code rollback alone is sufficient.
6. Upgrade Postgres/Redis/MinIO images independently and separately from app
   deploys, one at a time, each preceded by its own backup.
