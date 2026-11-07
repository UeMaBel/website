# Production Compose

`compose.production.yaml` runs the production stack on one host. It does not
provision the host, DNS, firewall, credentials, or backups.

## Configure

Create a protected environment file outside the repository from
`production.env.example`. Set `SITE_DOMAIN`, `DJANGO_SECRET_KEY`,
`POSTGRES_PASSWORD`, `POSTGRES_DB`, and `POSTGRES_USER`. Keep the file
operator-readable only and never commit production secrets.

Point the domain to the host and allow inbound TCP 80 and 443. Caddy handles
HTTPS; it is the only service with published host ports. PostgreSQL, Django,
and the frontend stay on private Compose networks. The database, uploads,
static files, and Caddy state persist in named volumes.

## Start and check

Replace the example path with the protected environment file path:

```sh
docker compose --env-file /protected/path/production.env -f compose.production.yaml config --quiet
docker compose --env-file /protected/path/production.env -f compose.production.yaml pull
docker compose --env-file /protected/path/production.env -f compose.production.yaml up --detach --wait
docker compose --env-file /protected/path/production.env -f compose.production.yaml ps
```

Create the first administrator with:

```sh
docker compose --env-file /protected/path/production.env -f compose.production.yaml exec backend python manage.py createsuperuser
```

## Stop and backups

Stop containers without deleting persistent data:

```sh
docker compose --env-file /protected/path/production.env -f compose.production.yaml down
```

Do not use `down --volumes` unless you intend to delete the database, uploads,
and Caddy certificate state. Compose does not provide offsite backups; follow
[backup and restore](backup-restore.md).
