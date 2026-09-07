# Self-Hosted Postgres + PgBouncer

How the production database is hosted after the migration off Neon: a
self-managed **Postgres 18** cluster fronted by **PgBouncer** on a single OCI
VM, reached by Vercel over the public internet with TLS.

Audience: the maintainer returning in six months, or someone rebuilding the box
from scratch after losing it.

> **This repository is public.** Every credential, IP address, and secret below
> is a placeholder — `<password>`, `<vm-public-ip>`, `<user>`. Never commit the
> real values. The only real hostname here is `db.kiyon.store`, which is already
> public DNS.

---

## Architecture

```text
Vercel serverless functions
        │  postgres://…@db.kiyon.store:6432/octo?sslmode=verify-full
        ▼  (public internet, TLS terminated at PgBouncer)
┌──────────────────────────────────────────────────────────┐
│ OCI VM  (hostname: store)                                │
│                                                          │
│  fail2ban ── bans via iptables chain DOCKER-USER         │
│                                                          │
│  ┌──────────────────────┐    ┌────────────────────────┐  │
│  │ pgbouncer            │    │ postgres:18-alpine     │  │
│  │ edoburu/pgbouncer    │───▶│ 127.0.0.1:5432 only    │  │
│  │ 0.0.0.0:6432 (TLS)   │    │ (not publicly exposed) │  │
│  │ transaction pooling  │    │ volume: pgdata         │  │
│  └──────────────────────┘    └────────────────────────┘  │
│                                                          │
│  cron ── nightly pg_dump -Fc ──▶ ~/backups/              │
└──────────────────────────────────────────────────────────┘
```

| Component     | Detail                                                                  |
| ------------- | ----------------------------------------------------------------------- |
| Host          | OCI VM, hostname `store`                                                |
| Orchestration | `docker compose -f ~/docker/docker-compose.db.yml`                      |
| Database      | `postgres:18-alpine`, bound to `127.0.0.1:5432` (loopback only)         |
| Pooler        | `edoburu/pgbouncer:latest`, published `0.0.0.0:6432`, transaction       |
| TLS           | Let's Encrypt certificate for `db.kiyon.store`, terminated at PgBouncer |
| Client        | Vercel → `db.kiyon.store:6432`, `sslmode=verify-full`                   |
| Intrusion     | fail2ban, banning through the `DOCKER-USER` iptables chain              |
| Backups       | Nightly `pg_dump -Fc` into `~/backups/`                                 |
| Roles         | Database, user, and dbname are all `octo`                               |

Only port `6432` needs to be open to the internet for the database. Postgres
itself is never publicly reachable — it is reached only through the pooler or
through loopback on the VM.

---

## Config files

All paths are on the VM. Nothing here lives in this repository.

### `~/docker/docker-compose.db.yml`

Reconstruction — adjust to taste, then validate with
`docker compose -f docker-compose.db.yml config` before applying.

```yaml
services:
  postgres:
    image: postgres:18-alpine
    restart: unless-stopped
    ports:
      - '127.0.0.1:5432:5432'
    environment:
      POSTGRES_USER: octo
      POSTGRES_DB: octo
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    command:
      - postgres
      - -c
      - max_connections=200
      - -c
      - shared_buffers=256MB
      - -c
      - shared_preload_libraries=pg_stat_statements
    volumes:
      - pgdata:/var/lib/postgresql
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U octo -d octo']
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 15s

  pgbouncer:
    image: edoburu/pgbouncer:latest
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    ports:
      - '6432:5432'
    environment:
      DB_HOST: postgres
      DB_PORT: 5432
      DB_USER: octo
      DB_NAME: octo
      DB_PASSWORD: ${POSTGRES_PASSWORD}
      POOL_MODE: transaction
      AUTH_TYPE: scram-sha-256
      ADMIN_USERS: octo
      CLIENT_TLS_SSLMODE: require
      CLIENT_TLS_CERT_FILE: /etc/letsencrypt/live/db.kiyon.store/fullchain.pem
      CLIENT_TLS_KEY_FILE: /etc/letsencrypt/live/db.kiyon.store/privkey.pem
    volumes:
      - /etc/letsencrypt:/etc/letsencrypt:ro
    logging:
      driver: syslog
      options:
        tag: pgbouncer
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -h 127.0.0.1 -p 5432 -U octo']
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 15s

volumes:
  pgdata:
```

Notes that are easy to get wrong:

- **`edoburu/pgbouncer:latest` is unpinned.** That is what the box currently
  runs, but a rebuild can pull a different version with different environment
  variable semantics. Pin a specific tag or digest when you next touch it, as
  `postgres:18-alpine` already is.
- **Volume mount.** Postgres 18+ expects a single mount at
  `/var/lib/postgresql`; the image places the cluster in a version-named
  subdirectory beneath it. Pre-18 images mounted `/var/lib/postgresql/data`
  instead. Mounting the old path against an 18 image gives you an empty or
  mis-initialised cluster.
- **`command` is a YAML list**, not a block scalar. A block scalar is passed as
  a single argv element and Postgres will not start.
- **`logging: driver: syslog`** on PgBouncer is required so fail2ban has a file
  to tail. See gotcha 3 for the tradeoff.
- `POSTGRES_PASSWORD` comes from `~/docker/.env`, which is never committed
  anywhere.

### `/etc/docker/daemon.json`

```json
{ "userland-proxy": false }
```

Apply with `sudo systemctl restart docker`. Mandatory — see gotcha 1.

### `/etc/fail2ban/filter.d/pgbouncer.conf`

```ini
[Definition]
failregex = pgbouncer\[\d+\]: .* ERROR .*@<HOST>:\d+ password authentication failed
            pgbouncer\[\d+\]: .* ERROR .*@<HOST>:\d+ .*no such user
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
banaction = iptables-allports
chain     = DOCKER-USER
ignoreip  = 127.0.0.1/8 172.16.0.0/12 10.0.0.0/8
```

Reload with `sudo systemctl restart fail2ban`.

### Nightly backup script

**Template — adjust paths, retention, and the cron schedule before use.**
`~/bin/pg-backup.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="$HOME/backups"
RETENTION_DAYS=14
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/octo-$STAMP.dump"

mkdir -p "$BACKUP_DIR"

# Dump against the Postgres container directly, never through PgBouncer
# (see gotcha 5).
docker compose -f "$HOME/docker/docker-compose.db.yml" exec -T postgres \
  pg_dump -U octo -d octo -Fc > "$OUT"

# Prune anything older than the retention window.
find "$BACKUP_DIR" -name 'octo-*.dump' -type f -mtime "+$RETENTION_DAYS" -delete
```

Cron entry (`crontab -e`):

```cron
15 3 * * * /home/<user>/bin/pg-backup.sh >> /home/<user>/backups/backup.log 2>&1
```

---

## Gotchas

The expensive part. Each item cost real debugging time.

### 1. `userland-proxy: false` is mandatory for fail2ban to work

**Symptom.** Every externally-published connection appears in the PgBouncer log
with the Docker bridge gateway (e.g. `172.18.0.1`) as the client address. fail2ban
then bans the bridge itself and locks out every client, including Vercel.

**Cause.** Docker's default userland proxy (`docker-proxy`) relays traffic and
rewrites the source address; the container sees the bridge, not the real client.

**Fix.** Set `{"userland-proxy": false}` in `/etc/docker/daemon.json` and restart
Docker. Docker then uses pure iptables DNAT, which preserves real source IPs.

```bash
ps aux | grep -c '[d]ocker-proxy'          # expect 0
sudo grep 'authentication failed' /var/log/syslog | tail   # expect real public IPs
```

### 2. fail2ban must use `chain = DOCKER-USER`

**Symptom.** The jail reports banned IPs, but nothing is actually blocked — the
attacker keeps connecting.

**Cause.** Docker's published ports bypass the `INPUT` chain entirely, so the
default `iptables-multiport` banaction inserts rules that traffic never
traverses. It looks like it works and drops nothing.

**Fix.** `banaction = iptables-allports` with `chain = DOCKER-USER`.

```bash
sudo iptables -L f2b-pgbouncer -n          # rules must be present and populated
# From a banned host, the connection never reaches authentication — it is
# dropped (hangs until timeout) or refused, depending on the fail2ban blocktype:
psql "postgres://octo:<password>@db.kiyon.store:6432/octo?sslmode=verify-full"
```

### 3. PgBouncer must log to syslog, not `json-file`

**Symptom.** fail2ban never matches anything because `logpath` has nothing to
tail.

**Cause.** With the default `json-file` driver, container logs live in Docker's
JSON store, not in a plain log file.

**Fix.** `logging: { driver: syslog, options: { tag: pgbouncer } }`.

**Tradeoff.** `docker compose logs pgbouncer` no longer works. Read logs with:

```bash
sudo grep pgbouncer /var/log/syslog | tail -100
```

Rotation is handled by the system logrotate on `/var/log/syslog`; there is no
`max-size` equivalent to configure on the container.

### 4. YAML duplicate keys

**Symptom.** A `logging:` or `command:` block appears to be ignored.

**Cause.** Two identical keys in the same service mapping is ambiguous — some
parsers silently take the last one, others error.

**Fix.** Always validate before applying:

```bash
docker compose -f ~/docker/docker-compose.db.yml config
```

### 5. Restore through loopback `:5432`, never through the pooler

**Symptom.** `pg_restore` fails partway with errors about prepared statements or
lost session state.

**Cause.** PgBouncer in transaction pooling mode multiplexes connections;
session state, prepared statements, and multi-statement transactions do not
survive that.

**Fix.** Restore against Postgres directly on `127.0.0.1:5432` from the VM.

### 6. Use `DROP SCHEMA public CASCADE` rather than `pg_restore --clean`

**Symptom.** `pg_restore --clean` fails partway, leaving a half-populated
database.

**Cause.** `--clean` drops objects individually and cannot drop through
foreign-key dependencies.

**Fix.** Reset the schema first, then restore:

```sql
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
```

### 7. `sslrootcert=system` is required for libpq clients, not for node-postgres

**Symptom.** `psql` fails with `root certificate file … does not exist`, while
the app connects fine with the same URL.

**Cause.** libpq looks for `~/.postgresql/root.crt` by default. node-postgres
(`pg`) is pure JS, ignores libpq options entirely, and uses Node's built-in CA
bundle, which already trusts Let's Encrypt.

**Fix.** Append `&sslrootcert=system` for `psql` only. Do not add it to
`DATABASE_URL` on Vercel — it does nothing there.

### 8. Local `verify-full` connections must use the cert hostname

**Symptom.** Connecting to `127.0.0.1:6432` with `sslmode=verify-full` fails
with a hostname mismatch.

**Cause.** That is correct behaviour: the certificate is issued for
`db.kiyon.store`.

**Fix.** Use the real hostname even from the VM itself.

### 9. `shared_preload_libraries` requires a Postgres restart

**Symptom.** `pg_stat_statements` exists as a view but is permanently empty.

**Cause.** `CREATE EXTENSION pg_stat_statements` alone is not enough; the
library must be preloaded at server start.

**Fix.** Ensure `-c shared_preload_libraries=pg_stat_statements` is in the
`command:` list and restart the container. Verify:

```sql
show shared_preload_libraries;
```

Note that the collected statistics reset on every restart.

### 10. Ports 80/443 are intentionally left open

Ports 80 and 443 are open on the OCI Security List because other VMs on the same
VCN serve HTTP/S. This is a deliberate decision, not an oversight — do not
"tidy it up".

---

## Vercel configuration

Connection string:

```text
postgres://octo:<password>@db.kiyon.store:6432/octo?sslmode=verify-full
```

Environment variables:

```bash
DATABASE_URL=<above>
DATABASE_DRIVER=postgres
DATABASE_POOL_MAX=2
DATABASE_POOL_IDLE_TIMEOUT_MS=10000
```

| Variable                        | Why this value                                                       |
| ------------------------------- | -------------------------------------------------------------------- |
| `DATABASE_DRIVER=postgres`      | Selects the node-postgres driver rather than the Neon serverless one |
| `DATABASE_POOL_MAX=2`           | Deliberately low, see below                                          |
| `DATABASE_POOL_IDLE_TIMEOUT_MS` | Returns idle connections quickly as instances go cold                |
| `READ_DATABASE_URL`             | **Leave unset** — there is no read replica                           |

**Why `DATABASE_POOL_MAX=2`.** Each Vercel serverless instance opens its own
pool, and dozens can be live concurrently. `max_client_conn` on PgBouncer is a
global ceiling across all of them, so raising this value is the fastest way to
exhaust it and start refusing connections. Scale `DEFAULT_POOL_SIZE` on
PgBouncer before touching this.

**Password encoding.** A password containing any of `@ : / ? # %` must be
percent-encoded in the URL or the connection string will parse incorrectly
(`@` → `%40`, `:` → `%3A`, `/` → `%2F`, `?` → `%3F`, `#` → `%23`, `%` → `%25`).

---

## Operations runbook

All commands run on the VM unless stated otherwise.

### Pool health

```bash
psql "postgres://octo:<password>@db.kiyon.store:6432/pgbouncer?sslmode=verify-full&sslrootcert=system" \
  -c 'SHOW POOLS;'
```

| Column       | Read it as                                             |
| ------------ | ------------------------------------------------------ |
| `cl_active`  | Client connections currently served                    |
| `cl_waiting` | Clients queued for a server connection — should be `0` |
| `sv_active`  | Server connections in use                              |
| `maxwait`    | Longest current wait in seconds — should be `0`        |

`cl_waiting > 0` or `maxwait` above roughly 1s means clients are queuing; raise
`DEFAULT_POOL_SIZE`. Healthy observed baseline: **11 client connections
multiplexed onto 5 server connections, `maxwait = 0`**.

### PgBouncer logs

```bash
sudo grep pgbouncer /var/log/syslog | tail -100
sudo grep 'authentication failed' /var/log/syslog | tail
```

`docker compose logs pgbouncer` does **not** work — see gotcha 3.

### fail2ban

```bash
sudo fail2ban-client status pgbouncer          # jail status and banned list
sudo fail2ban-client set pgbouncer unbanip <ip>
sudo iptables -L f2b-pgbouncer -n              # confirm bans are actually enforced
sudo iptables -L DOCKER-USER -n                # confirm the jump into the jail chain
```

### Slow queries

```sql
SELECT
  calls,
  round(mean_exec_time::numeric, 2) AS mean_ms,
  round(total_exec_time::numeric, 2) AS total_ms,
  query
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;
```

Observed baseline: **all queries under 5ms**. Anything materially above that is
new. Remember that statistics reset on restart (gotcha 9).

### Stock reservations

A leaked `reservedStock` decrement silently strands inventory — availability is
computed as `stock - reservedStock`, so stranded holds make products look sold
out. Check periodically:

```sql
-- Reservation states currently on record.
SELECT status, count(*) FROM "StockReservation" GROUP BY status ORDER BY status;

-- Expired holds that are still HELD: these should have been released.
SELECT count(*) FROM "StockReservation"
WHERE status = 'HELD' AND "expiresAt" < now();

-- Variants holding stock, cross-checked against live HELD reservations.
SELECT
  v.id,
  v.stock,
  v."reservedStock",
  coalesce(sum(r.quantity) FILTER (WHERE r.status = 'HELD'), 0) AS live_held
FROM "ProductVariant" v
LEFT JOIN "StockReservation" r ON r."variantId" = v.id
GROUP BY v.id, v.stock, v."reservedStock"
HAVING v."reservedStock" <> coalesce(sum(r.quantity) FILTER (WHERE r.status = 'HELD'), 0)
ORDER BY v."reservedStock" DESC;
```

Rows returned by the last query are drift between the summed live holds and the
denormalised counter, and want investigating.

### Verifying a backup restores

> **This has not been done yet. Do it.** An unverified backup is not a backup.

Restore the most recent dump into a fresh scratch database, against Postgres
directly rather than through the pooler (gotcha 5). A newly created database is
already empty, so the schema reset from gotcha 6 is not needed here — it only
matters when restoring over an existing, populated database.

```bash
CID=$(docker compose -f ~/docker/docker-compose.db.yml ps -q postgres)

docker exec -i "$CID" psql -U octo -d postgres -c 'CREATE DATABASE octo_restore_test;'

docker exec -i "$CID" pg_restore -U octo -d octo_restore_test --no-owner \
  < ~/backups/octo-<stamp>.dump

# Spot-check, then drop the scratch database.
docker exec -i "$CID" psql -U octo -d octo_restore_test \
  -c 'SELECT count(*) FROM "Product";'
docker exec -i "$CID" psql -U octo -d postgres -c 'DROP DATABASE octo_restore_test;'
```

### Restart / rebuild

```bash
cd ~/docker
docker compose -f docker-compose.db.yml config    # validate first (gotcha 4)
docker compose -f docker-compose.db.yml up -d
docker compose -f docker-compose.db.yml ps
```

Rebuilding the box from scratch: install Docker, write
`/etc/docker/daemon.json` (gotcha 1), obtain the Let's Encrypt certificate for
`db.kiyon.store`, restore the compose file and `.env`, bring the stack up,
restore the newest dump through loopback, then install the fail2ban filter and
jail and confirm enforcement with `iptables -L f2b-pgbouncer -n`.
