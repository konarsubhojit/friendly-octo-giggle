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

---

## Architecture

```text
Vercel serverless functions
        │  postgres://…@db.kiyon.store:6432/octo?sslmode=verify-full
        ▼  (public internet, TLS terminated at PgBouncer)
┌──────────────────────────────────────────────────────────┐
│ OCI VM  (hostname: store)                                │
│                                                          │
│ fail2ban ── bans via iptables chain DOCKER-USER           │
│                                                          │
│ ┌────────────────────────┐    ┌────────────────────────┐ │
│ │ pgbouncer (Docker)     │───▶│ native PostgreSQL 18   │ │
│ │ network_mode: host     │    │ 127.0.0.1:5432 only    │ │
│ │ 0.0.0.0:6432 (TLS)     │    │ (not publicly exposed) │ │
│ │ transaction pooling    │    └────────────────────────┘ │
│ └────────────────────────┘                               │
│                                                          │
│ systemd timer ── pg_dump -Fc ──▶ OCI Object Storage      │
└──────────────────────────────────────────────────────────┘
```

| Component | Detail                                                                              |
| --------- | ----------------------------------------------------------------------------------- |
| Host      | OCI VM, hostname `store`                                                            |
| Database  | Native PostgreSQL 18, loopback-only `127.0.0.1:5432`                                |
| Pooler    | `edoburu/pgbouncer:latest` in Docker with `network_mode: host`, transaction pooling |
| TLS       | Let's Encrypt certificate for `db.kiyon.store`, terminated at PgBouncer             |
| Client    | Vercel → `db.kiyon.store:6432`, `sslmode=verify-full`                               |
| Intrusion | fail2ban, banning through the `DOCKER-USER` iptables chain                          |
| Backups   | **None currently.** Install the systemd/OCI Object Storage pattern below.           |
| Roles     | `octo`, `postgres`, and `wetalk`                                                    |

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
```

`network_mode: host` exposes PgBouncer's native `6432` listener directly; do
not add `ports:`. The image writes `/etc/pgbouncer/userlist.txt` at startup.
Keep the current recommendation to pin `edoburu/pgbouncer:latest` to a specific
tag or digest on the next maintenance pass. `POSTGRES_PASSWORD` comes from
`~/docker/.env`, which is never committed.

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
banaction = iptables-allports
chain     = DOCKER-USER
ignoreip  = 127.0.0.1/8 172.16.0.0/12 10.0.0.0/8
```

Validate the filter, then reload:

```bash
sudo fail2ban-regex /var/log/syslog /etc/fail2ban/filter.d/pgbouncer.conf
sudo systemctl restart fail2ban
```

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

### 2. fail2ban must use `chain = DOCKER-USER`

**Symptom.** The jail reports banned IPs, but the attacker keeps connecting.

**Cause.** Docker-related traffic does not necessarily traverse `INPUT`; the
`DOCKER-USER` chain is the verified enforcement point on this VM.

**Fix.** Keep `banaction = iptables-allports` and `chain = DOCKER-USER`.

**Testing traps.** fail2ban ignores localhost (`Ignore 127.0.0.1 by
ignoreself rule`), so failed-auth tests must come from an external host. Also,
with `actionstart_on_demand`, `f2b-pgbouncer` does not exist while there are
zero active bans. Its absence is not evidence of breakage.

**Verification.** Trigger failed logins from an external cloud VM, then:

```bash
sudo fail2ban-client status pgbouncer
sudo iptables -L f2b-pgbouncer -n
sudo iptables -L DOCKER-USER -n
```

From a banned host the connection is dropped (hangs until timeout) or refused,
depending on the fail2ban blocktype.

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
`DEFAULT_POOL_SIZE`. Read logs from syslog, not `docker compose logs`.

### Backups

**No backups currently exist.** The prior proposed cron job was never installed:
there is no `~/backups/`, `backup.log`, or cron entry. Do not recreate it. It
put dumps on the same disk as the database, which does not protect against VM
or disk loss. Use off-VM OCI Object Storage instead.

Install this adaptation of the proven `studious-robot` pattern as
`/usr/local/bin/<script>` (replace every angle-bracket placeholder before
installing):

```bash
#!/usr/bin/env bash
set -euo pipefail
umask 077
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

readonly BUCKET="<oci-bucket>"
readonly OCI="<oci-cli-path>"
readonly MIN_SIZE=1048576
readonly MIN_PREVIOUS_SIZE_PERCENT=75
readonly PREFIX="pg"
export OCI_CLI_AUTH=instance_principal

workdir="$(mktemp -d)"
dump="$workdir/backup.dump"
trap 'rm -rf "$workdir"' EXIT
stamp="$(date -u +%Y/%m/%d/%H%M%SZ)"
key="$PREFIX/$stamp.dump"

sudo -u postgres pg_dump -d octo -Fc -f "$dump"
size="$(stat -c '%s' "$dump")"
if (( size < MIN_SIZE )); then
  echo "Backup is ${size} bytes, below MIN_SIZE ${MIN_SIZE}" >&2
  exit 1
fi

previous_key="$("$OCI" os object list --bucket-name "$BUCKET" --prefix "$PREFIX/" \
  --query 'data | sort_by(@, &name) | [-1].name' --raw-output 2>/dev/null || true)"
if [[ -n "$previous_key" && "$previous_key" != "null" ]]; then
  previous_size="$("$OCI" os object head --bucket-name "$BUCKET" --name "$previous_key" \
    --query '"content-length"' --raw-output 2>/dev/null || true)"
  if [[ "$previous_size" =~ ^[0-9]+$ ]]; then
    minimum_previous_size=$((previous_size * MIN_PREVIOUS_SIZE_PERCENT / 100))
    if (( size < minimum_previous_size )); then
      echo "Backup is ${size} bytes, below ${MIN_PREVIOUS_SIZE_PERCENT}% of previous ${previous_size}" >&2
      exit 1
    fi
  else
    echo "Warning: cannot read previous object size; relying on MIN_SIZE" >&2
  fi
fi

"$OCI" os object put \
  --bucket-name "$BUCKET" --name "$key" --file "$dump" --content-md5 --force
echo "Uploaded $key (${size} bytes)"
```

Use the instance principal; do not store OCI credentials on the VM. The
`mktemp` staging directory, `trap`, and `umask 077` keep the transient dump
private and guarantee cleanup. Smoke-test the installed script with no ambient
environment:

```bash
sudo -i env -i /usr/local/bin/<script>
```

Install a systemd timer, not cron. Cron sends stderr to an unread root mail
spool; systemd provides journald logs, `systemctl status`, a visible failure
state, and `OnFailure=` hooks.

`/etc/systemd/system/wetalk-backup.service`:

```ini
[Unit]
Description=Upload PostgreSQL backup to OCI Object Storage
OnFailure=wetalk-backup-failure.service

[Service]
Type=oneshot
ExecStart=/usr/local/bin/<script>
ExecStartPost=/usr/bin/curl --fail --retry 3 https://hc-ping.com/<healthchecks-success-uuid>
```

`/etc/systemd/system/wetalk-backup.timer`:

```ini
[Unit]
Description=Nightly PostgreSQL backup

[Timer]
OnCalendar=*-*-* 03:15:00 UTC
Persistent=true
RandomizedDelaySec=30m
Unit=wetalk-backup.service

[Install]
WantedBy=timers.target
```

`/etc/systemd/system/wetalk-backup-failure.service`:

```ini
[Unit]
Description=Notify Healthchecks.io that the PostgreSQL backup failed

[Service]
Type=oneshot
ExecStart=/usr/bin/curl --fail --retry 3 https://hc-ping.com/<healthchecks-failure-uuid>/fail
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now wetalk-backup.timer
systemctl list-timers wetalk-backup.timer
systemctl status wetalk-backup.service
journalctl -u wetalk-backup.service
```

### Verifying a backup restores

> **This has not been done yet. Do it.** An unverified backup is not a backup.

Download an object first rather than piping it to `pg_restore`, so its archive
contents can be verified before touching a database. Restore against native
Postgres directly (gotcha 5).

```bash
OCI_CLI_AUTH=instance_principal <oci-cli-path> os object get \
  --bucket-name <oci-bucket> --name pg/YYYY/MM/DD/HHMMSSZ.dump \
  --file /tmp/octo-restore-test.dump
pg_restore -l /tmp/octo-restore-test.dump

sudo -u postgres psql -d postgres -c 'CREATE DATABASE octo_restore_test;'
pg_restore -h 127.0.0.1 -p 5432 -U octo -d octo_restore_test --no-owner \
  /tmp/octo-restore-test.dump
psql -h 127.0.0.1 -p 5432 -U octo -d octo_restore_test \
  -c 'SELECT count(*) FROM "Product";'
sudo -u postgres psql -d postgres -c 'DROP DATABASE octo_restore_test;'
rm -f /tmp/octo-restore-test.dump
```

For an existing database, reset `public` first as described in gotcha 6. This
restore procedure has not yet been exercised.

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
`.env`; bring up PgBouncer; download and validate the newest OCI dump, then
restore it through `127.0.0.1:5432`; install the fail2ban filter and jail; and
verify enforcement from an external host (gotcha 2).
