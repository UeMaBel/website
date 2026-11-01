# Website backup restore drill

This repeatable drill validates the complete website database and uploaded
media recovery path with disposable data. It creates a Django superuser and
author, a published tagged post, a valid PNG, and a one-page PDF using
[`scripts/restore_drill.py`](../scripts/restore_drill.py). The helper refuses
to seed a database that already contains its drill records. Use a new Compose
project and separate generated environment files; never point the drill at
production.

## Prepare and back up disposable data

Follow the local environment setup in [`backup-restore.md`](backup-restore.md)
and create two protected copies of `compose.env.example`: `source.env` and
`restore.env`. Use new Django and PostgreSQL secrets in both. Give them unique
project names and different free loopback ports, such as source port 3060 and
restore port 3061, with matching `PUBLIC_SITE_ORIGIN` values. Keep the files
and drill output outside the repository:

```sh
drill="$(mktemp -d)"
chmod 700 "$drill"
umask 077
# Create source.env and restore.env from compose.env.example, then set secrets,
# POSTGRES_DB/USER/PASSWORD, PROXY_PORT, and matching PUBLIC_SITE_ORIGIN.
```

From the repository root, start the source project and create the sample
content. The passwords are generated only to create local disposable accounts.
The helper doesn't print them or store them outside the database volume.

```sh
docker compose --project-name ticket59-source --file compose.yaml \
  --env-file "$drill/source.env" up --build --detach --wait
docker compose --project-name ticket59-source --file compose.yaml \
  --env-file "$drill/source.env" cp scripts/restore_drill.py backend:/tmp/restore_drill.py
docker compose --project-name ticket59-source --file compose.yaml \
  --env-file "$drill/source.env" exec -T backend env RESTORE_DRILL_ACTION=seed \
  python manage.py shell -c "exec(open('/tmp/restore_drill.py').read())"
python scripts/backup_restore.py backup --compose-file compose.yaml \
  --env-file "$drill/source.env" --project-name ticket59-source \
  --output "$drill/backup"
```

The backup directory contains `database.dump`, `media.tar.gz`, and
`manifest.json`. The manifest checksums are checked before any restore
resources are created.

## Restore into an isolated project

Use only the fresh restore environment and a new project name beginning with
`restore-`. The restore project's PostgreSQL credentials may differ from the
source project's credentials. The command restricts restores to the
loopback-only `compose.yaml` and leaves the verified stack running.

```sh
python scripts/backup_restore.py restore --env-file "$drill/restore.env" \
  --project-name restore-ticket59 --backup "$drill/backup"
docker compose --project-name restore-ticket59 --file compose.yaml \
  --env-file "$drill/restore.env" cp scripts/restore_drill.py backend:/tmp/restore_drill.py
docker compose --project-name restore-ticket59 --file compose.yaml \
  --env-file "$drill/restore.env" exec -T backend env RESTORE_DRILL_ACTION=verify \
  python manage.py shell -c "exec(open('/tmp/restore_drill.py').read())"
curl -fsS http://localhost:3061/api/v1/blog/posts/
```

The verifier checks the superuser and author rows, their roles, the post,
author and tag relationship, PNG signature/decoding, PDF signature/page, and
both media files in Django storage. It prints the restored image/PDF URLs.
Fetch those URLs through the proxy as well. The verifier's final line is JSON,
so the shell can pass its URLs to curl:

```sh
verification=$(docker compose --project-name restore-ticket59 --file compose.yaml \
  --env-file "$drill/restore.env" exec -T backend env RESTORE_DRILL_ACTION=verify \
  python manage.py shell -c "exec(open('/tmp/restore_drill.py').read())" | tail -n 1)
image_url=$(printf '%s\n' "$verification" | python3 -c 'import json,sys; print(json.load(sys.stdin)["image_url"])')
pdf_url=$(printf '%s\n' "$verification" | python3 -c 'import json,sys; print(json.load(sys.stdin)["pdf_url"])')
curl -fsS -o /dev/null "http://localhost:3061$image_url"
curl -fsS -o /dev/null "http://localhost:3061$pdf_url"
```

## Verify container recreation

Capture IDs and volume names, remove containers without deleting volumes, then
start the stack with fresh containers. Re-run the verifier and fetch both
media URLs again. Never add `--volumes` to this step.

```sh
restore_compose=(docker compose --project-name restore-ticket59 --file compose.yaml --env-file "$drill/restore.env")
before_ids=$("${restore_compose[@]}" ps --quiet)
before_volumes=$(docker volume ls --quiet --filter label=com.docker.compose.project=restore-ticket59 | sort)
"${restore_compose[@]}" down
test "$before_volumes" = "$(docker volume ls --quiet --filter label=com.docker.compose.project=restore-ticket59 | sort)"
"${restore_compose[@]}" up --detach --wait --force-recreate
after_ids=$("${restore_compose[@]}" ps --quiet)
test "$before_ids" != "$after_ids"
"${restore_compose[@]}" cp scripts/restore_drill.py backend:/tmp/restore_drill.py
"${restore_compose[@]}" exec -T backend env RESTORE_DRILL_ACTION=verify python manage.py shell -c "exec(open('/tmp/restore_drill.py').read())"
curl -fsS http://localhost:3061/api/v1/blog/posts/
```

The named PostgreSQL, media, and static volumes must still exist after `down`,
and the post/user records and media URLs must still pass verification after
the new containers become healthy.

## Recover from the encrypted Restic repository

When recovering a ticket58 encrypted snapshot, first set the repository and
password-file settings for the authorized Restic client, then inspect the
snapshot's source paths:

```sh
restic snapshots --tag personal-website
restic ls latest --tag personal-website
```

Restore only the `current/website` subtree shown by `restic ls` into a private
directory, then pass that directory to `backup_restore.py restore` as above.
For the production staging path, the selector is normally
`latest:/var/lib/personal-website-backup/current/website`; use the exact path
reported by the selected snapshot if it differs.

On Windows, restoring the whole Restic snapshot path to a target directory
returned exit code 1 in this drill because Restic could not reapply the
timestamp to an ancestor `C:\Users` directory (`Access is denied`). Selecting
the `current/website` subtree instead returned 0 and restored the three backup
files directly into the target, ready for the website restore command. This
does not affect `backup_restore.py restore` when given an extracted backup
directory.

## Failure checks and cleanup

The restore safety checks are repeatable on disposable data. Reusing an
existing `restore-*` project exits non-zero without replacing its containers
or volumes. To test integrity rejection, copy the backup directory, append a
few bytes to `database.dump`, and run restore with a fresh `restore-*` name;
it must report a checksum mismatch and create no Compose resources.

After recording results, remove only the two disposable Compose projects and
their volumes, then remove the protected drill directory:

```sh
docker compose --project-name restore-ticket59 --file compose.yaml \
  --env-file "$drill/restore.env" down --volumes
docker compose --project-name ticket59-source --file compose.yaml \
  --env-file "$drill/source.env" down --volumes
rm -rf -- "$drill"
```

## Verification record

On 2026-11-01, this drill ran on Windows 11 with Python 3.14, Docker Engine
27.1.1, and Docker Compose 2.29.1. `backup_restore.py backup` and `restore`
both returned 0. A restore with the first representative fixture restored two
users, a published tagged post, and a PNG/PDF (77 and 429 bytes), both served
through Caddy with HTTP 200. After `compose down` without `--volumes`, all
three named volumes remained; `up --force-recreate` produced five new
container IDs, and the same database/media checks passed again. A second
backup ran through ticket58's Restic runner; restoring its `current/website`
subtree and then using `backup_restore.py restore` returned 0, and the checked-in
helper verified its two additional users and post. The corrupt checksum and
existing-project checks both returned 1 before changing or creating restore
resources. The Restic full-path timestamp issue and successful subtree restore
are described above. No production host, credentials, or content were used.
