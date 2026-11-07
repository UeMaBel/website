# Production deployment

GitHub Actions checks the backend, frontend, and Compose stack on pushes to
`main`. When all checks pass, it publishes backend and frontend images to
GHCR with `:prod` and immutable `:sha-<commit>` tags. It does not deploy to
the server; updates are initiated in Portainer or with Docker Compose.

Image names:

```text
ghcr.io/<lowercase-owner>/personal-website-backend:prod
ghcr.io/<lowercase-owner>/personal-website-frontend:prod
```

## One-time setup

1. Allow GitHub Actions to publish packages. Make both GHCR packages public,
   or configure a read-only `read:packages` credential on the server.
2. Prepare Docker Engine, Compose, and Portainer. Point DNS to the host and
   allow inbound TCP 80/443.
3. Create a protected `production.env` outside the repository from
   `production.env.example`. Set the site domain, Django secret, and database
   credentials.
4. Create a Portainer Web Editor stack from `compose.production.yaml` named
   `personal-website-production`. Set `IMAGE_PREFIX` to
   `ghcr.io/<lowercase-owner>` and provide the values from `production.env`.

## Update

After a successful GitHub build, choose **Pull and redeploy** in Portainer and
enable pulling the latest images. Django applies migrations and collects
static files at startup. Check service health and the public site afterward.

To update from a server shell, use the same Compose project and file as
Portainer so named volumes are reused:

```sh
docker compose --env-file /protected/path/production.env -f /protected/path/compose.production.yaml pull backend frontend
docker compose --env-file /protected/path/production.env -f /protected/path/compose.production.yaml up --detach --wait
docker compose --env-file /protected/path/production.env -f /protected/path/compose.production.yaml ps
```

Use one update method at a time. For a specific build, set both images to the
same `sha-<commit>` tag before pulling. To roll back, use the previous known-
good tags for both images. Migrations are not automatically reversed; keep
changes compatible with the previous release and maintain verified
[offsite backups](offsite-backups.md).

## Local Compose check

```sh
bash .github/scripts/compose-smoke.sh
```
