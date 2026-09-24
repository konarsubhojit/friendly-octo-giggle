# Self-Hosted Postgres + PgBouncer

How the production database is hosted after the migration off Neon: a native
**Postgres 18** cluster, fronted by a containerized PgBouncer on a single OCI
VM, reached by Vercel over the public internet with TLS.

Audience: the maintainer returning in six months, or someone rebuilding the box
from scratch after losing it.

> **This repository is public.** Every credential, IP address, bucket name, OCI
> CLI path, and secret below is a placeholder — `<password>`, `<user>`,
> `<vm-public-ip>`, `<oci-bucket>`, `<oci-cli-path>`. Never commit the real
> values. The only real hostname here is `db.kiyon.store`, which is already
> public DNS.

This document covers the database tier only. For a **fully self-hosted**
deployment — Next.js, Nginx, Redis, and MinIO alongside Postgres, all on one
VM — see [`docs/kamatera-deployment.md`](./kamatera-deployment.md), which
reuses the Postgres/PgBouncer topology described here.

---

## CI provider matrix

The `provider-matrix` job in `.github/workflows/build.yml` proves the
self-hosted profile's adapters against real disposable services rather than
mocks: `postgres:16-alpine` and `redis:7-alpine` run as job `services:`, and
the pinned `quay.io/minio/minio` image is started as a plain container in a
step to avoid Docker Hub anonymous-pull denials (GitHub Actions
`services:` cannot override a container's command, and MinIO's image needs
`server /data` on its command line). The job applies migrations with
`npm run db:migrate`, then runs three opt-in integration suites that are
otherwise skipped in the main `test` job:

| Suite                                                                      | Exercises                                                                         |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `__tests__/features/orders/services/stock-reservation.integration.test.ts` | The reservation guarantee against real Postgres (`RESERVATION_TEST_DATABASE_URL`) |
| `__tests__/lib/cache/redis-integration.test.ts`                            | `NodeRedisCacheClient` against real Redis (`CACHE_TEST_REDIS_URL`)                |
| `__tests__/lib/storage/s3-integration.test.ts`                             | `createS3StorageAdapter()` against real MinIO (`STORAGE_TEST_S3_*`)               |

These suites are gated on dedicated `*_TEST_*` environment variables — never
the production `DATABASE_URL`/`REDIS_URL`/`S3_*` names — specifically so a
contributor's real local or production credentials can never accidentally
trigger a destructive run. `__tests__/lib/cache/contract.test.ts` and
`__tests__/lib/storage/contract.test.ts` cover the same adapters' behavioral
contracts against faked SDKs in the ordinary hermetic unit run, so CI still
catches contract regressions even when the opt-in variables are unset (for
example, in a fork's pull request, which does not get the `provider-matrix`
job's services).

The CI service intentionally remains `postgres:16-alpine`; it is test tooling,
not a description of `oci-new`, which runs native PostgreSQL 18.

To run the same suites locally: start disposable containers for Postgres,
Redis, and MinIO (see `docs/kamatera-deployment.md` for compose examples),
export the `*_TEST_*` variables to point at them, run `npm run db:migrate`
against the disposable Postgres, then `npm test` (or target the three files
directly with `npx vitest run <path>...`).

---

## Architecture

```text
Vercel serverless functions
        │  postgres://…@db.kiyon.store:6432/octo?sslmode=verify-full
        ▼  (public internet, TLS terminated at PgBouncer)
┌──────────────────────────────────────────────────────────┐
│ OCI VM  (hostname: oci-new)                              │
│                                                          │
│ fail2ban ── bans via iptables INPUT chain                 │
│                                                          │
│ ┌────────────────────────┐    ┌────────────────────────┐ │
│ │ pgbouncer (Docker)     │───▶│ native PostgreSQL 18   │ │
│ │ network_mode: host     │    │ 127.0.0.1:5432 only    │ │
│ │ 0.0.0.0:6432 (TLS)     │    │ (not publicly exposed) │ │
│ │ transaction pooling    │    └────────────────────────┘ │
│ └────────────────────────┘                               │
│                                                          │
│ systemd timers ── pg_dump -Fc + age ──▶ OCI Object Storage│
└──────────────────────────────────────────────────────────┘
```

| Component | Detail |
| --- | --- |
| Host      | Oracle Cloud Ampere A1 (arm64; use arm64-compatible images), 2 OCPU, 12 GB RAM; hostname `oci-new` |
| Database  | Native PostgreSQL 18, loopback-only `127.0.0.1:5432`                                               |
| Pooler    | `edoburu/pgbouncer:latest` in Docker with `network_mode: host`, transaction pooling                |
| TLS       | Let's Encrypt certificate for `db.kiyon.store`, terminated at PgBouncer                            |
| Client    | Vercel → `db.kiyon.store:6432`, `sslmode=verify-full`                                              |
| Intrusion | fail2ban, using `iptables-multiport` on the `INPUT` chain                                          |
| Backups   | Two age-encrypted systemd jobs upload to OCI Object Storage                                        |
| Roles     | `octo`, `postgres`, and `wetalk`                                                                   |

Only port `6432` needs to be open to the internet. Postgres is never publicly
reachable; it is reached through loopback on the VM, while PgBouncer reaches it
over the host network.

---

## Config files

All paths are on the VM. Nothing here lives in this repository.

### `~/docker/docker-compose.db.yml`

Reconstruction — adjust to taste, then validate with
`docker compose -f docker-compose.db.yml config` before applying.

```yaml
services:
  pgbouncer:
    image: edoburu/pgbouncer:latest
    restart: unless-stopped
    network_mode: host
    environment:
      DB_HOST: 127.0.0.1
      DB_PORT: '5432'
      DB_USER: octo
      DB_NAME: octo
      DB_PASSWORD: ${POSTGRES_PASSWORD}
      POOL_MODE: transaction
      AUTH_TYPE: scram-sha-256
      ADMIN_USERS: octo
      LISTEN_ADDR: 0.0.0.0
      LISTEN_PORT: '6432'
      CLIENT_TLS_SSLMODE: require
      CLIENT_TLS_CERT_FILE: /etc/pgbouncer/tls/db.kiyon.store.crt
      CLIENT_TLS_KEY_FILE: /etc/pgbouncer/tls/db.kiyon.store.key
    volumes:
      - /etc/pgbouncer/tls:/etc/pgbouncer/tls:ro
    logging:
      driver: syslog
      options:
        tag: pgbouncer
```

`network_mode: host` exposes PgBouncer's native `6432` listener directly; do
not add `ports:`. The deployed host currently uses
`edoburu/pgbouncer:latest`; pin it to a tag or digest on the next maintenance
pass: protocol-level prepared-statement emulation requires PgBouncer 1.21 or
newer, so a silent rollback below that version would break Drizzle's named
statements in transaction pooling without a configuration change. The
reconstruction intentionally has no health check because the host file has
none; do not add one without validating it on the host. `POSTGRES_PASSWORD`
comes from `~/docker/.env`, which is never committed.

TLS material is copied into `/etc/pgbouncer/tls/`, rather than mounted from
`/etc/letsencrypt`. The copied, bind-mounted server key must be mode `0600` and
owned by uid/gid `70:70`, the `pgbouncer` user inside this container image.
Host-user ownership causes PgBouncer to fail at startup. Apply the ownership and
mode to `/etc/pgbouncer/tls/db.kiyon.store.key` before starting the container:

```bash
sudo chown 70:70 /etc/pgbouncer/tls/db.kiyon.store.key
sudo chmod 0600 /etc/pgbouncer/tls/db.kiyon.store.key
```

Copying a renewed key into `/etc/pgbouncer/tls/` resets it to the host user's
ownership, so repeat both commands after every certbot renewal copy or
replacement.

`SHOW CONFIG;` on the PgBouncer admin console verifies
`max_prepared_statements = 200`. This non-default image setting emulates
protocol-level prepared statements, so Drizzle's named statements work with
transaction pooling. The host leaves `MAX_CLIENT_CONN` and
`DEFAULT_POOL_SIZE` unset; `SHOW CONFIG;` reports their effective values as 100
and 20 respectively. Those values are reasonable starting points for this 2
OCPU / 12 GB host, but set them explicitly in the Compose file before tuning so
the deployed limit is clear.

Client-to-PgBouncer traffic uses TLS, but PgBouncer-to-Postgres traffic is
plaintext over loopback (`DB_HOST: 127.0.0.1`). That is safe while Postgres
remains loopback-only; it is not end-to-end encryption. `ADMIN_USERS: octo` is
also a hardening concern: it gives the application's role access to the
PgBouncer admin console, including `PAUSE`, `RELOAD`, and `SHUTDOWN`, and the
same role is present in Vercel's `DATABASE_URL`. Use a dedicated admin user;
this has not yet been changed.

### Native PostgreSQL

The cluster is configured at `/etc/postgresql/18/main/`, not in Docker. Keep
`listen_addresses = '127.0.0.1'` in `postgresql.conf` so only local processes
can connect to port 5432. Set preload libraries in that same file:

```conf
shared_preload_libraries = 'pg_stat_statements'
```

Then restart native Postgres once:

```bash
sudo systemctl restart postgresql
sudo -u postgres psql -c 'SHOW shared_preload_libraries;'
```

This restart resets `pg_stat_statements`; do not restart it merely to recreate
PgBouncer credentials.

### `/etc/docker/daemon.json`

```json
{ "userland-proxy": false }
```

This setting is irrelevant while PgBouncer uses `network_mode: host`. Retain it
as a safeguard for anyone changing to published Docker ports; then apply it
with `sudo systemctl restart docker` and follow gotcha 1.

### `/etc/fail2ban/filter.d/pgbouncer.conf`

```ini
[Definition]
failregex = pgbouncer\[\d+\]: .* ERROR .*@<HOST>:\d+ password authentication failed
            pgbouncer\[\d+\]: .* ERROR .*@<HOST>:\d+ .*no such user
            pgbouncer\[\d+\]: .* WARNING .*@<HOST>:\d+ pooler error: SASL authentication failed
ignoreregex =
```

### `/etc/fail2ban/jail.d/pgbouncer.conf`

```ini
[pgbouncer]
enabled   = true
port      = 6432
filter    = pgbouncer
logpath   = /var/log/syslog
maxretry  = 5
findtime  = 600
bantime   = 3600
banaction = iptables-multiport
ignoreip  = 127.0.0.1/8 172.16.0.0/12 10.0.0.0/8
```

Validate the filter, then reload:

```bash
sudo fail2ban-regex /var/log/syslog /etc/fail2ban/filter.d/pgbouncer.conf
sudo systemctl restart fail2ban
```

### Firewall persistence

The persisted firewall must be checked whenever the live rules change.
`/etc/iptables/rules.v4` can predate the `6432` `ACCEPT` rule, in which case a
reboot silently closes the public PgBouncer port.

Do not persist fail2ban's transient chains. `netfilter-persistent save` writes
live `f2b-*` chain declarations and `INPUT` jump rules into `rules.v4`; those
rules are restored before fail2ban starts and can leave duplicate jumps or a
jump to a chain that fail2ban does not consider its own. Save in this exact
order:

```bash
sudo fail2ban-client unban --all
sudo netfilter-persistent save
sudo sed -i '/f2b-/d' /etc/iptables/rules.v4
sudo sh -c 'iptables-restore --test < /etc/iptables/rules.v4'
sudo sed -i '/f2b-/d' /etc/iptables/rules.v6
sudo sh -c 'ip6tables-restore --test < /etc/iptables/rules.v6'
```

Inspect both files to confirm the intended permanent rules, including the
IPv4 `6432` `ACCEPT` rule. Do **not** run `netfilter-persistent save` again
after removing the `f2b-*` lines, or it will reintroduce the live fail2ban
state. The redirect must be opened by a root shell as shown; `sudo
iptables-restore --test < /etc/iptables/rules.v4` still opens the file as the
invoking user and fails with permission denied. Apply the same persistence
check and root-shell redirect to `rules.v6`.

---

## Gotchas

The expensive part. Each item cost real debugging time.

### 1. `userland-proxy: false` matters only if switching to published ports

**Symptom.** After changing from host networking to published ports, every
external connection appears as the Docker bridge gateway in the PgBouncer log.

**Cause.** Docker's userland proxy can relay traffic and rewrite the source
address, so fail2ban sees the bridge rather than the real client.

**Fix.** With published ports, set `{"userland-proxy": false}` in
`/etc/docker/daemon.json` and restart Docker. This does not apply to the
current `network_mode: host` deployment.

**Verification.**

```bash
ps aux | grep -c '[d]ocker-proxy'          # expect 0 with published ports
sudo grep 'authentication failed' /var/log/syslog | tail
```

### 2. fail2ban uses `iptables-multiport` on `INPUT`

**Symptom.** The jail reports banned IPs, but the attacker keeps connecting.

**Cause.** A jail action or chain copied from a different Docker networking
setup may not match this host's host-networked PgBouncer traffic.

**Fix.** Use the stock `iptables-multiport` action. On `oci-new` it inserts the
jail jump in `INPUT`; do not override it to use `DOCKER-USER`.

**Testing traps.** fail2ban ignores localhost (`Ignore 127.0.0.1 by
ignoreself rule`), so failed-auth tests must come from an external host. Also,
with `actionstart_on_demand`, `f2b-pgbouncer` does not exist while there are
zero active bans. Its absence is not evidence of breakage.

**Verification.** Trigger failed logins from an external cloud VM, then:

```bash
sudo fail2ban-client status pgbouncer
sudo fail2ban-client get pgbouncer actions
sudo iptables -L f2b-pgbouncer -n
sudo iptables -L INPUT -n
sudo nft list ruleset
```

The observed action name is `iptables-multiport`. A test ban installed a
`REJECT` rule at position 1 of `f2b-pgbouncer`, reached from `INPUT`. The host
uses the `iptables-nft` compatibility layer, but `nft list ruleset` shows no
native `f2b-table`; inspect fail2ban rules with `iptables -L`, not by expecting
a native nftables table.

### 3. PgBouncer must log to syslog, not `json-file`

**Symptom.** fail2ban never matches anything because `logpath` has nothing to
tail.

**Cause.** The default `json-file` driver writes in Docker's JSON store, not a
plain log file.

**Fix.** Use `logging: { driver: syslog, options: { tag: pgbouncer } }`.

**Verification.**

```bash
sudo grep pgbouncer /var/log/syslog | tail -100
```

`docker compose logs pgbouncer` no longer works. System logrotate manages
`/var/log/syslog`; there is no `max-size` equivalent to configure.

### 4. YAML duplicate keys

**Symptom.** A `logging:` block appears to be ignored.

**Cause.** Two identical keys in one service mapping are ambiguous.

**Fix and verification.**

```bash
docker compose -f ~/docker/docker-compose.db.yml config
```

### 5. Restore against Postgres directly, never through the pooler

**Symptom.** `pg_restore` fails partway with prepared-statement or lost-session
errors.

**Cause.** Transaction pooling multiplexes connections; session state and
multi-statement transactions do not survive it.

**Fix.** Use `127.0.0.1:5432` or `sudo -u postgres`, never port 6432.

### 6. Use `DROP SCHEMA public CASCADE` rather than `pg_restore --clean`

**Symptom.** `pg_restore --clean` leaves a half-populated database.

**Cause.** Individual object drops cannot always satisfy foreign-key
dependencies.

**Fix.**

```sql
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
```

### 7. `sslrootcert=system` is required for libpq clients, not node-postgres

**Symptom.** `psql` cannot find its root certificate while the app connects.

**Cause.** libpq looks for `~/.postgresql/root.crt`; node-postgres uses Node's
trusted CA bundle.

**Fix.** Append `&sslrootcert=system` for `psql` only. Do not add it to Vercel's
`DATABASE_URL`.

### 8. Local `verify-full` connections must use the certificate hostname

**Symptom.** `127.0.0.1:6432` fails TLS hostname verification.

**Cause.** The certificate is issued for `db.kiyon.store`.

**Fix.** Use the hostname even from the VM.

### 9. `shared_preload_libraries` requires a PostgreSQL restart

**Symptom.** `pg_stat_statements` exists but stays empty.

**Cause.** Creating the extension does not preload its library.

**Fix.** Set `shared_preload_libraries = 'pg_stat_statements'` in
`/etc/postgresql/18/main/postgresql.conf`, then restart native Postgres.

**Verification.**

```bash
sudo -u postgres psql -c 'SHOW shared_preload_libraries;'
```

### 10. DNS must remain DNS-only

**Symptom.** Connections to `db.kiyon.store:6432` silently hang without an
error.

**Cause.** `db.kiyon.store` resolves to Cloudflare proxy IPs when orange-cloud
proxied, and Cloudflare's proxy forwards only HTTP/S.

**Fix.** Keep the record grey-cloud / DNS-only.

**Verification.**

```bash
dig +short db.kiyon.store
psql "postgres://octo:<password>@db.kiyon.store:6432/octo?sslmode=verify-full&sslrootcert=system" -c 'SELECT 1;'
```

### 11. Ports 80/443 are intentionally left open

Ports 80 and 443 are open on the OCI Security List because other VMs on the
same VCN serve HTTP/S. This is deliberate.

---

## Vercel configuration

```text
postgres://octo:<password>@db.kiyon.store:6432/octo?sslmode=verify-full
```

```bash
DATABASE_URL=<above>
DATABASE_DRIVER=postgres
DATABASE_POOL_MAX=2
DATABASE_POOL_IDLE_TIMEOUT_MS=10000
```

Leave `READ_DATABASE_URL` unset: there is no read replica. Each Vercel instance
has its own pool, so keep `DATABASE_POOL_MAX` low and scale PgBouncer's
`DEFAULT_POOL_SIZE` first. A password containing `@ : / ? # %` must be
percent-encoded; prefer hex passwords to avoid URL encoding altogether.

---

## Operations runbook

All commands run on the VM unless stated otherwise.

### Pool health and logs

```bash
psql "postgres://octo:<password>@db.kiyon.store:6432/pgbouncer?sslmode=verify-full&sslrootcert=system" -c 'SHOW POOLS;'
sudo grep pgbouncer /var/log/syslog | tail -100
sudo grep 'authentication failed' /var/log/syslog | tail
```

`cl_waiting > 0` or `maxwait` above roughly 1s means clients are queuing; raise
`DEFAULT_POOL_SIZE`. It currently inherits the implicit value of 20, so set it
explicitly in the Compose file before raising it. Read logs from syslog, not
`docker compose logs`.

### Performance tuning: verify before changing

All values here are conventional starting points to verify, not measured
recommendations for this workload. Check:

```bash
sudo -u postgres psql -c 'SHOW shared_buffers;'
```

If `shared_buffers` is still the 128 MB packaged default, it is likely the
largest single available tuning opportunity on this 12 GB host. About 3 GB for
`shared_buffers`, 8 GB for `effective_cache_size`, and 512 MB for
`maintenance_work_mem` are starting values to validate against actual load and
memory pressure. With only 2 OCPUs, keep `max_parallel_workers_per_gather` low:
parallel plans can cost more than they save under concurrency.

Consider `auto_explain` with `log_min_duration` aligned to the application's
2500 ms slow-query warning threshold documented in
[`docs/troubleshooting.md`](./troubleshooting.md). `pg_stat_statements` is
already configured; do not duplicate it here. Product search already uses
`pg_trgm` and `unaccent` through `idx_products_name_unaccent_trgm`,
`idx_products_unaccent_search_vector`, and the generated `search_vector`
column in `src/lib/schema.ts`, so they are not new recommendations. As a
possible future option only, `pg_partman` could replace the
`AdminAuditLog` retention job's bulk `DELETE` with partition dropping; it is
not planned or decided.

### Backups

`oci-new` runs two systemd timer/service pairs. `wetalk-backup` writes under
`pg/` at 00:05 UTC, and `octo-backup` writes under `octo/` at 00:45 UTC. The
offset is intentional: the two `pg_dump` processes must never overlap.

`/usr/local/bin/octo-backup.sh` is a copy of the wetalk backup script with
`PREFIX="${BACKUP_PREFIX:-pg}"` replacing the hardcoded `pg/` prefix at all
four prefix-sensitive sites:

1. `oci os object list --prefix`
2. the `grep -oE` pattern used to select an earlier object's size
3. `oci os object put --name`
4. the `uploading …` status message

Unlike the wetalk source script, which lives in a separate repository, the
octo variant is not version-controlled in any repository. It exists only on
the host at mode `0750`, so this is a known rebuild risk: the rebuild procedure
cannot restore it from an upstream source without a separately retained copy.

The existing `grep -oE` pattern must change from single quotes to double
quotes when `${PREFIX}` is introduced. Otherwise the variable does not expand.
That failure is silent: the previous-object lookup misses, the shrink guard
degrades to the static `MIN_SIZE` floor, and only a warning is emitted.

The octo job reads `/etc/octo-backup.env`, which must remain mode `0600`. The
service selects it with:

```ini
Environment=BACKUP_ENV_FILE=/etc/octo-backup.env
```

That selected file sets `BACKUP_PREFIX=octo`; without it, the script's `pg`
default would write octo backups into the wetalk prefix.

This indirection is safety-critical. The shared script runs `set -a` and
self-sources `BACKUP_ENV_FILE` after systemd has applied `EnvironmentFile=`.
Setting octo's `DATABASE_URL` only in the unit would therefore allow the
wetalk environment to overwrite it silently, backing up the wrong database
under `octo/` without an error.

`BUCKET` is assigned before the selected environment file is sourced, so
`BACKUP_BUCKET` in `/etc/octo-backup.env` has no effect. If the bucket must be
overridden, set `BACKUP_BUCKET` in the systemd unit instead. The octo
`DATABASE_URL` must point to `127.0.0.1:5432`, never port `6432`; `pg_dump`
cannot run through PgBouncer's transaction pooling.

Do not leave the literal `<password>` placeholder in `/etc/octo-backup.env`.
When sourced, the shell interprets `<` as input redirection and produces
`line 1: password: No such file or directory`. Single-quote the
`DATABASE_URL` value in that file so its URL syntax is preserved.

Both jobs create a custom-format dump and age-encrypt it before it leaves the
host. Object keys use `<prefix>/%Y/%m/%d/%H%M%SZ.dump.age`. The age private key
must never exist on the VM, and the script fails closed when
`BACKUP_AGE_RECIPIENT` is unset.

Octo uses `MIN_SIZE=60000`, based on a roughly 246 KB dump through the actual
backup path. An ad hoc dump as `postgres` measured 128757 bytes, while the same
database dumped through the backup path measured 246187 bytes because
visibility is role-dependent. Establish and update the guard by measuring
through the backup path, not with an ad hoc privileged dump.

The observed encrypted objects
`octo/2026/09/24/141736Z.dump.age` and
`octo/2026/09/24/154011Z.dump.age` are both 246435 bytes, with server-side MD5
confirmed. The second run exercised the shrink guard against a real previous
`.age` object.

### Old-host cutover

Until the old `oci` instance is terminated, two hosts write incompatible
formats under `octo/`. The old host creates a second, **unencrypted**
`octo/<stamp>.dump` at approximately 01:03 UTC each day, while `oci-new`
creates dated `.dump.age` objects.

Do not set an Object Storage lifecycle rule on `octo/` until `oci-new` is the
sole writer. After the old instance is terminated, delete its plaintext
`.dump` objects from Object Storage.

### Verifying a backup restores

#### Not yet verified

No age-encrypted dump has been downloaded, decrypted, and restored off-host
for either database. That test must gate termination of the old `oci` instance.
The realistic recovery scenario is the loss of the VM, so a procedure exercised
only on that VM has not tested the failure case the backups exist to cover.

### Credential rotation

Before rotating **any** role, enumerate every consumer. `pg_stat_activity`
showing zero connections does not mean a role is unused: lazy application pools
may have no connection at that instant. In particular, `wetalk` is consumed by
the separate `studious-robot` deployment through `DATABASE_URL` in
`/etc/robot-signal/env`, read by both its systemd service and backup script.
Missing that file breaks both consumers silently. `octo` consumers include
PgBouncer's compose environment and Vercel's `DATABASE_URL`.

Prefer a hex password to avoid connection-string percent encoding. Preserve
shell history before editing it, and remove secrets afterward:

```bash
history -a
export HISTIGNORE='*PASSWORD*:*postgres://*:*PGPASSWORD*'
```

Do not use `psql -c 'ALTER ROLE ... PASSWORD :'password''`: `:'var'` is not
interpolated with `-c` (`-v` applies only to stdin or `-f`), producing
`ERROR: syntax error at or near ":"`. Do not use an unquoted hex value either:
Postgres reports `ERROR: trailing junk after numeric literal`. Use a quoted
heredoc:

```bash
sudo -u postgres psql -v new_secret="<password>" <<'SQL'
ALTER ROLE octo PASSWORD :'new_secret';
SQL
```

Update each enumerated consumer before verification:

```bash
# Update PgBouncer's POSTGRES_PASSWORD in ~/docker/.env, then regenerate
# /etc/pgbouncer/userlist.txt without restarting PostgreSQL.
docker compose -f ~/docker/docker-compose.db.yml up -d --force-recreate pgbouncer

# Update octo's DATABASE_URL in Vercel, then redeploy the application.
# Update /etc/robot-signal/env and restart its service when rotating wetalk.

psql "postgres://octo:<password>@127.0.0.1:5432/octo" -c 'SELECT 1;'
psql "postgres://octo:<password>@db.kiyon.store:6432/octo?sslmode=verify-full&sslrootcert=system" -c 'SELECT 1;'
history -c && history -r
```

PgBouncer must be force-recreated to regenerate `userlist.txt`. Postgres needs
no restart, avoiding an unnecessary `pg_stat_statements` reset.

### Restart / rebuild

```bash
cd ~/docker
docker compose -f docker-compose.db.yml config    # gotcha 4
docker compose -f docker-compose.db.yml up -d --force-recreate pgbouncer
docker compose -f docker-compose.db.yml ps
```

Rebuilding from scratch: install native PostgreSQL 18; configure its
loopback-only listener and `pg_stat_statements`; install Docker; write
`/etc/docker/daemon.json` if published ports will be used (gotcha 1); obtain
the certificate for `db.kiyon.store`; restore PgBouncer's compose file and
`.env`; restore the TLS key's `70:70` ownership and `0600` mode; bring up
PgBouncer; select the newest `octo/**/*.dump.age` object written by `oci-new`,
then download, decrypt, and validate it off-host before restoring it through
`127.0.0.1:5432`; install the fail2ban filter and jail; restore and verify the
persistent firewall rules; verify enforcement from an external host (gotcha
2); restore both backup scripts, their `0600` environment files, and their
systemd service/timer units; then enable both timers and verify their 00:05 and
00:45 UTC schedules remain non-overlapping.
