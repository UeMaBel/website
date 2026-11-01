# Encrypted off-server backups

`scripts/offsite_backup.py` runs the consistent database-and-media backup from
ticket57, writes it to a private temporary directory, sends it to a Restic
repository, applies retention, and removes the plaintext staging copy. Restic
encrypts and authenticates data client-side before transfer; SFTP additionally
encrypts the connection. A failed backup, transfer, or prune exits non-zero,
prints the failed command and error, and is recorded by systemd in the journal.
The runner uses an exclusive lock and stable staging path to prevent
overlapping runs and let Restic group snapshots for retention.

## Inputs and setup

Production use requires operator-provided infrastructure and secrets; this
ticket does not provision a server or destination:

- Python 3.10+, Docker Compose v2, Restic, OpenSSH client, and systemd on the
  source host. The `website-backup` user must be able to access the Docker
  socket and production Compose environment file.
- An off-server SFTP account and repository directory, plus its hostname,
  username, SSH private key, and pinned host key. Configure the
  `website-backup` user's `/home/website-backup/.ssh/config` with a `website-backup`
  host alias, `IdentityFile`, `IdentitiesOnly yes`, `StrictHostKeyChecking yes`,
  and a protected `UserKnownHostsFile`. Verify the host key fingerprint through
  an independent trusted channel; do not trust a first connection prompt.
- A randomly generated Restic repository password stored in the protected
  file referenced by `RESTIC_PASSWORD_FILE`. Keep a recoverable copy separate
  from both servers. Without this password Restic snapshots cannot be
  decrypted. The SSH key authenticates transport; the Restic password protects
  backup contents if the destination is disclosed.

Copy `deploy/offsite-backup.env.example` to
`/etc/personal-website/offsite-backup.env`, set its values, and restrict the
file to the service operator. Create the staging and cache directories with
that user as owner and mode 0700. Create the Restic password file with mode
0600. Install Restic from its official distribution and verify the published
checksum/signature for the selected release. The example destination uses
SFTP syntax understood by Restic and the SSH host alias configured above.

Initialize the remote repository once, interactively as the service user,
before enabling the schedule:

```sh
sudo -u website-backup env \
  RESTIC_REPOSITORY=sftp:website-backup:/srv/restic/personal-website \
  RESTIC_PASSWORD_FILE=/etc/personal-website/restic-password \
  restic init
```

Protect the remote account so it can write only to the intended backup
directory. Do not enable automatic repository initialization in the scheduled
job: a typo in a destination must fail visibly instead of silently creating a
new repository.

## Daily schedule and failure visibility

Deploy the application and this repository's scripts under
`/opt/personal-website`, install the three unit files from `deploy/systemd/`
under `/etc/systemd/system/`, then enable the persistent daily timer:

```sh
sudo systemctl daemon-reload
sudo systemctl enable --now personal-website-backup.timer
systemctl list-timers personal-website-backup.timer
```

The timer runs around 02:15 local host time with up to 15 minutes of jitter.
`Persistent=true` runs a missed backup after the host returns. On failure,
systemd records stderr and the failed status in the journal, and the
`OnFailure` unit emits an error-priority syslog/journal message. Operators can
inspect and rerun it with:

```sh
systemctl status personal-website-backup.service
journalctl -u personal-website-backup.service --since today
journalctl -p err --grep personal-website-backup --since today
sudo systemctl start personal-website-backup.service
```

Retention defaults to the most recent 90 days with backups (`BACKUP_RETENTION_DAYS`).
Restic keeps daily snapshots in that rolling interval and prunes unreferenced
repository data only after a successful new snapshot. Keep a separate
monitoring process or alert subscription on service failures; a local journal
message is visible on the source host but cannot notify an operator if that
host is unreachable.

## Repeatable local encrypted-transfer drill

This drill uses a disposable SFTP container as an isolated destination. It
proves SSH host-key pinning, key authentication, encrypted transfer, retention,
and failure behavior without production credentials or a remote host. Use a
disposable Compose project and local environment as in
`docs/backup-restore.md`.

```sh
drill="$(mktemp -d)"
umask 077
ssh-keygen -q -t ed25519 -N '' -f "$drill/id_ed25519"
docker run --detach --name website-offsite-sftp \
  --publish 127.0.0.1:2222:22 \
  --mount "type=bind,source=$drill/id_ed25519.pub,target=/home/website-backup/.ssh/keys/authorized_keys,readonly" \
  atmoz/sftp:alpine website-backup::1001:1001:upload
until ssh-keyscan -p 2222 127.0.0.1 > "$drill/known_hosts" 2>/dev/null; do sleep 1; done
python3 -c 'import secrets; print(secrets.token_urlsafe(36))' > "$drill/restic-password"
export RESTIC_REPOSITORY=sftp://website-backup@127.0.0.1:2222/upload/repository
export RESTIC_PASSWORD_FILE="$drill/restic-password"
export RESTIC_SFTP_ARGS="-i $drill/id_ed25519 -o UserKnownHostsFile=$drill/known_hosts -o StrictHostKeyChecking=yes"
restic_sftp() { restic -o "sftp.args=$RESTIC_SFTP_ARGS" "$@"; }
restic_sftp init
export BACKUP_PROJECT_NAME=website-offsite-drill
export BACKUP_COMPOSE_FILE=compose.yaml
export BACKUP_ENV_FILE=/protected/path/website-local.env
export BACKUP_STAGING_ROOT="$drill/staging"
export BACKUP_RETENTION_DAYS=90
python3 scripts/offsite_backup.py
restic_sftp snapshots --tag personal-website
```

To prove expiry, create an old snapshot with the same stable source path, then
run the job again. The final snapshot listing should retain the new backup and
omit the dated snapshot:

```sh
mkdir -p "$BACKUP_STAGING_ROOT/current/website"
printf 'old test snapshot\n' > "$BACKUP_STAGING_ROOT/current/website/old-test.txt"
restic_sftp backup --host personal-website --tag personal-website \
  --time '2026-01-01 02:15:00' "$BACKUP_STAGING_ROOT/current/website"
python3 scripts/offsite_backup.py
restic_sftp snapshots --tag personal-website
```

For visible failure, temporarily point `RESTIC_PASSWORD_FILE` to a missing
path and run the command directly: it must exit non-zero with an
`offsite_backup: error` on stderr. Restore the correct local-drill path after
the check. Never test retention against a production repository. After
recording results, remove only the disposable Compose project and container,
then delete the `drill` directory. The SFTP image and SSH host key are local
test inputs only; production requires a separately verified host fingerprint.

The website backup includes the website database and uploaded media. Analytics
has its own data lifecycle and is intentionally outside this backup.
