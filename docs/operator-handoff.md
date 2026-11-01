# Operator and agent handoff

This page is the entry point for a clean checkout and routine maintenance. It
links to the detailed procedures so commands and safety constraints have one
canonical home. It does not authorize provisioning a host or deploying the live
site.

## Start from a clean clone

Install Git, Docker Engine with Compose v2, Python 3.14 and Node 24.22.2 (npm
11.6.2). Clone the repository and start the local stack from its root:

```sh
git clone <repository-url> personal-website
cd personal-website
cp compose.env.example backend/.env
```

Generate two unrelated local-only values and put them in `backend/.env` as
`DJANGO_SECRET_KEY` and `POSTGRES_PASSWORD`:

```sh
python -c "import secrets; print(secrets.token_urlsafe(50))"
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

Follow [local Compose](local-compose.md) for the complete environment contract,
startup/readiness, same-origin routes, demo isolation, and volume lifecycle. The
normal start and first-admin flow is:

```sh
docker compose --env-file backend/.env up --build --wait --wait-timeout 180
docker compose --env-file backend/.env exec backend python manage.py createsuperuser
```

Open `http://localhost:3000/` and `http://localhost:3000/admin/`. Admin
creation is interactive and the stack intentionally does not seed an account.
Use unique throwaway secrets locally; never copy production credentials into a
clone.

## Checks and review workflow

For a code change, follow `AGENTS.md`, the relevant ticket acceptance criteria,
and the per-ticket branch/worktree workflow in the ticket. Create a fresh
`ticket/NN-short-description` branch from current `origin/main`; keep one ticket
per branch. Run the applicable checks before committing. Pull requests run the
same controlled checks in GitHub Actions:

- [Backend checks](../.github/workflows/backend.yml): locked `uv` install,
  settings tests, Ruff, Django checks/migration drift, migrations and backend
  tests (PostgreSQL service required).
- [Frontend checks](../.github/workflows/frontend.yml): `npm ci`, lint,
  typecheck, tests with controlled API fixtures, production build.
- [Container integration](../.github/workflows/container-integration.yml):
  local Compose configuration/build/readiness/routing smoke.

The implementer commits only ticket changes and hands the branch and local
check results to an independent reviewer. Do not push or merge an unreviewed
branch. The reviewer updates against current `main`, reruns affected checks,
then pushes and opens a PR targeting `main`; wait for required checks and review
approval before merge. If `main` advances, update and recheck before merge. Never
force-push or bypass failed/required checks. The release workflow creates
reviewed images from a version tag; see [publishing images](../.github/workflows/publish-images.yml)
and [deployment](../.github/workflows/deploy-production.yml).

## Runtime configuration and updates

The local stack reads `backend/.env`; production reads a protected env file
outside the checkout. Never commit either. Variable meanings and HTTPS behavior
are documented in [production Compose](production-compose.md). Local HTTP
defaults are intentionally separate from production secure-cookie, trusted
proxy, CSRF-origin and HSTS settings.

For local content updates, use Django admin and the repeatable
[live-content drill](live-content-drill.md).
Content is fetched server-side without a persistent frontend content cache, so
publishing/editing does not require a frontend build. For reviewed code updates,
merge through PR and build/publish a new immutable image tag; do not edit a
running container. Production inputs and the manual gated release flow are in
[production Compose](production-compose.md) and
[the deployment workflow](../.github/workflows/deploy-production.yml).

## Deployment inputs (not supplied here)

Production needs an operator-selected host and DNS domain; DNS and firewall
access for HTTPS; protected host and GitHub production environment; SSH host,
user, private key and pinned known-hosts; production Compose/env/backup paths;
registry owner and a reviewed integrated release tag; site domain; fresh Django
and database secrets; and an independently tested off-site backup destination
and credentials. Configure these only through the documented protected inputs.
The deploy workflow is manually dispatched and requires explicit deploy/rollback
selection and confirmation. No secrets or real endpoint values belong in this
repository. This handoff performs no host provisioning or deployment.

## Backup and restore

The application backup pairs a PostgreSQL dump with uploaded media and a
checksum manifest; static files are regenerated. Follow
[backup and isolated restore](backup-restore.md), then use the repeatable
[restore drill](restore-drill.md) before relying on a backup. Restore drills
must use a fresh `restore-*` Compose project, separate local secrets and port,
and disposable content. Never target a production project for a drill.

Daily encrypted off-site transfer, retention and visible job failures use
[the off-site backup guide](offsite-backups.md). Production scheduling requires
an operator-installed systemd service/timer, repository location, restricted
SFTP account or equivalent Restic destination, SSH identity/known-hosts,
Restic password, and protected environment/credential files. The guide's
disposable SFTP drill uses local-only keys and data; do not reuse those for a
real destination. Website database/media backups do not include analytics data.

## Independent demo and analytics lifecycle

The demo fixture is routed on its own hostname/network and has no database
access. Replace or update a demo independently from the website; keep any
project database private to that project's stack. See
[local Compose](local-compose.md) for network boundaries.

Umami is also an independent Compose project, database, volume and update
lifecycle. Start the website proxy first, then configure the analytics stack's
own `.env`, project name, proxy network and analytics hostname using
[the analytics stack guide](analytics-stack.md). Analytics must not be a
website startup or health dependency. Keep tracking disabled in production
until the operator has resolved the privacy notice, lawful basis, retention and
consent/opt-out requirements in [analytics policy](analytics.md). Use synthetic
visits and a local website ID for verification; never put dashboard credentials
in the browser or send preview/admin/API paths.

## Handoff verification

On 2026-11-01, the documented frontend commands passed: `npm test` (71 tests),
`npm run lint`, `npm run typecheck`, and `npm run build`. Host Node 24.12.0
reported an engine warning because the project pins Node 24.22.2; all checks
completed successfully. The repeatable local Compose procedure is the
[container integration smoke](../.github/workflows/container-integration.yml),
which runs `.github/scripts/compose-smoke.sh`. Locally, invoking that script
from Git Bash with a disposable port passed Compose configuration validation,
production image builds, isolated stack readiness, public/admin/static/media
checks, and public draft exclusion. The script removed its disposable
containers, volumes, and generated credentials on exit. The host lacked Python
for automatic port selection, so `CI_PROXY_PORT` was set explicitly. No
production host, credentials, registry login, or deploy workflow was used.
