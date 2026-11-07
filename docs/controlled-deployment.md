# Controlled production deployment

This is the legacy SSH deployment path. For automatic delivery to a
Portainer-managed stack, use [Portainer deployment](portainer-deployment.md).
Use one deployment owner per stack; do not target the same installation with both.

`.github/workflows/deploy-production.yml` is a manually dispatched deployment
workflow. It does not create a host, configure DNS/firewall, provision a
database, or deploy automatically. Do not run it until an operator has prepared
the host and GitHub's `production` environment has required reviewers enabled.

## Inputs and protected environment

Start **Deploy production** from the `main` branch. Select `deploy` for a new
release or `rollback` to return to a previously published image version. Enter
the exact published `vMAJOR.MINOR.PATCH` image tag, the lowercase public site
domain, and set the explicit confirmation to true. The workflow rejects tags
that are not semantic versions or whose source commit is not integrated into
`main`; workflow dispatch must also come from `main`.

Configure a GitHub Actions environment named `production`, with required
reviewers and deployment branch restrictions for `main`. Add these environment
secrets:

| Secret | Purpose |
| --- | --- |
| `PRODUCTION_HOST` | DNS name or IP address of the already prepared host |
| `PRODUCTION_SSH_USER` | Dedicated deployment account on that host |
| `PRODUCTION_SSH_PRIVATE_KEY` | Private key for that account; never use a personal key |

Add these environment variables:

| Variable | Purpose |
| --- | --- |
| `PRODUCTION_SSH_KNOWN_HOSTS` | Preverified host key line(s); the workflow enforces strict host key checking and does not run `ssh-keyscan` |
| `PRODUCTION_COMPOSE_DIRECTORY` | Absolute directory on the host containing the protected production environment file and persistent Compose state |
| `PRODUCTION_ENV_FILE` | Absolute path to the host's protected `production.env` file |
| `PRODUCTION_BACKUP_DIRECTORY` | Absolute, private host directory with sufficient space for database and media backups |

Prepare `compose.production.yaml`, the environment file, Docker Engine/Compose,
the directories above, the named volumes, and registry access on the host using
[production Compose guidance](production-compose.md). The environment file
must be owned by the deployment operator and mode `0400` or `0600`; its
`SITE_DOMAIN` must exactly match the dispatch input. Keep Django and database
secrets in that host file. Do not put secrets in workflow inputs, repository
files, or deployment logs. If GHCR packages are private, authenticate the host
to GHCR with a narrowly scoped read-only package credential before deployment;
the workflow does not transmit registry credentials to the host.

The deployment account needs Docker Compose access and write access only to
the configured Compose and backup directories. Restrict SSH ingress to the
operator/runner network as appropriate. Pin verified host keys in the
environment variable; do not disable host key checking.

## Deployment sequence and checks

The workflow serializes deployments and requires the protected `production`
environment approval. Before connecting, it validates the operation, tag,
domain, explicit confirmation, and tag ancestry. Over verified SSH, it checks
the prepared paths and environment file, then stages the reviewed Compose
configuration and a release overlay selecting the published backend/frontend
images. For a deploy, it confirms the existing database and backend are
healthy, stops backend writes, and saves a timestamped database and media
backup under the configured backup directory before changing application
images or applying migrations. It then pulls the selected images, displays the
migration plan, applies migrations, waits for healthy services, checks for
migration drift, and probes the public API, robots route, and static assets
through the local Caddy TLS endpoint.

If the operation fails after changing the release configuration, the workflow
restores the prior Compose files and restarts the prior application images.
The pre-migration backup is retained. The workflow does not automatically
restore database contents because doing so can discard writes made after the
backup. A failed automatic rollback requires operator inspection of the host,
service logs, retained backup, and current release before retrying.

Repeatable local checks that do not connect to a host or deploy:

```sh
actionlint .github/workflows/deploy-production.yml
docker compose --env-file /path/to/a-local-test-env -f compose.production.yaml config --quiet
```

For the Compose check, use disposable local-only values in a temporary file
with mode `0600`; never use production credentials. `actionlint` checks the
workflow structure and embedded shell. This local validation does not prove
SSH access, production host readiness, GHCR authentication, DNS/TLS, or the
remote health checks. Those checks require the future protected environment
inputs and an explicitly approved deployment, which this ticket does not run.

## Rollback and database compatibility

Choose `rollback` and a previously published semantic version tag to restore
that version's backend and frontend images. Rollback skips the workflow's
explicit migration-plan and migration-apply steps, and does not restore the
database backup. The production backend startup command still applies
migrations whenever a backend container starts, so image rollback starts
against the current database schema. Keep each release backward-compatible
with the immediately previous application version and schema throughout the
rollback window.

Use expand-and-contract migrations:

1. Add nullable columns/tables or otherwise additive schema first; deploy code
   that can operate with both old and new shapes.
2. Backfill data in a separately planned, observable operation where needed.
3. Deploy code that no longer reads the old shape, then wait until the
   rollback window closes and a verified backup exists.
4. Remove obsolete schema in a later release. Do not combine destructive
   schema changes with a release that must remain rollback-compatible.

Before deployment, review migration SQL and compatibility with both the
currently running and rollback image. The workflow takes a pre-migration
database and media backup but does not guarantee that an old image can use a
new schema. Restoring that backup is a deliberate recovery decision: first
stop writes, assess changes since the backup, and follow the documented
[backup/restore procedure](backup-restore.md) with a production-specific
recovery plan. Never point the development restore command at production.
Keep backups protected and retain them according to the separately managed
backup policy.
