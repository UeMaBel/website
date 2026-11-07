# Personal website

## Production stack

See [docs/portainer-deployment.md](docs/portainer-deployment.md) for CI checks,
GHCR image publishing, and manual server updates with Portainer.

See [docs/production-compose.md](docs/production-compose.md) for the
single-host production Compose configuration and its required deployment inputs.
See [docs/backup-restore.md](docs/backup-restore.md) for consistent database and
uploaded-media backup and isolated restore commands.
See [docs/operator-handoff.md](docs/operator-handoff.md) for clean-clone setup,
review workflow, runtime inputs, updates, and independent service lifecycles.

## Local stack

See [docs/local-compose.md](docs/local-compose.md) for the local Compose setup,
including environment configuration, service readiness, migrations, admin
creation, and persistent volume lifecycle.
