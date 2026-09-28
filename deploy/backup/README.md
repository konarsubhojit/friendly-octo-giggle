# Octo database backup

These files install the encrypted `octo` PostgreSQL backup on `oci-new`.
Replace every placeholder in the environment file with the host's actual
values; never commit the resulting file. `BACKUP_HEALTHCHECKS_URL` is a
write-capable Healthchecks.io credential.

## Install

Install the script, environment file, systemd service and timer, and healthcheck
drop-in:

```bash
sudo install -D -o root -g root -m 0750 deploy/backup/octo-backup.sh \
  /usr/local/bin/octo-backup.sh
sudo test -e /etc/octo-backup.env || \
  sudo install -o root -g root -m 0600 deploy/backup/octo-backup.env.example \
    /etc/octo-backup.env
sudo install -D -o root -g root -m 0644 deploy/backup/octo-backup.service \
  /etc/systemd/system/octo-backup.service
sudo install -D -o root -g root -m 0644 deploy/backup/octo-backup.timer \
  /etc/systemd/system/octo-backup.timer
sudo install -D -o root -g root -m 0644 \
  deploy/backup/octo-backup.service.d/override.conf \
  /etc/systemd/system/octo-backup.service.d/override.conf
```

Edit `/etc/octo-backup.env` before enabling the timer. Keep it owned by root
with mode `0600`. `DATABASE_URL` **must be single-quoted**. An unquoted
`<password>` placeholder is parsed as shell input redirection and fails with
`line 1: password: No such file or directory`.

The script requires `pg_dump`, `pg_restore`, `age`, `shred`, `openssl`, and the
OCI CLI at `/opt/oci-cli/bin/oci` (or set `OCI_BIN` in the systemd unit for a
different location). The database URL must connect directly to PostgreSQL on
`127.0.0.1:5432`, not through PgBouncer.

Reload systemd and enable the daily timer:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now octo-backup.timer
systemctl list-timers octo-backup.timer
```

Keep the installed script at mode `0750` and the root-owned environment file at
mode `0600`.

The timer is scheduled for 00:45 UTC with up to 15 minutes of randomized delay.
Check a run with `systemctl status octo-backup.service` and
`journalctl -u octo-backup.service`.
