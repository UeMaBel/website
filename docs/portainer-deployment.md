# Build on GitHub, update the server manually

Every push to `main` runs the Django checks, React checks, and disposable
Compose integration smoke. If they all pass, GitHub Actions builds the
production images and publishes each to GHCR with both a floating `:prod` tag
and an immutable `:sha-<commit>` tag. GitHub does not connect to Portainer or
the production server. You choose when to pull the new images and restart the
stack.

Image names:

```text
ghcr.io/<lowercase-owner>/personal-website-backend:prod
ghcr.io/<lowercase-owner>/personal-website-frontend:prod
```

The `prod` tag advances when a successful `main` build publishes. If the
workflow fails, the previous `prod` images remain available. The matching
`sha-<commit>` tags let you select a specific build instead.

## One-time setup

1. In GitHub repository settings, allow Actions to write packages. Set both
   GHCR packages to public for straightforward server pulls. If they must stay
   private, create a read-only `read:packages` credential and configure it on
   the server/Portainer registry. Never put that credential in this repository.
2. Prepare the production host with Docker Engine, the Compose plugin, and
   Portainer. Set DNS and allow public TCP 80/443 to Caddy. Make a protected
   `production.env` file outside the repository using
   `production.env.example`; set `SITE_DOMAIN`, Django's secret key, and the
   database credentials. Keep the file private to the deployment operator.
3. Configure the stack in Portainer from `compose.production.yaml`. Build
   contexts are local paths, so first create a server-side Compose file that
   uses the published images. From the repository root on a trusted machine,
   copy the production Compose file and make these changes in the server copy:
   replace the backend and frontend `build:` blocks with `image:` entries for
   the two `:prod` image names above. Keep the rest of the production
   configuration. Paste that file into a Portainer Web Editor stack named
   `personal-website-production`, set the stack environment values from
   `production.env`, and deploy it. Portainer stores the production values.

## Update after a successful GitHub build

In Portainer, open the stack and choose **Pull and redeploy**. Enable pulling
the latest image before redeploying. This fetches both updated `:prod` images;
Compose starts Django, which applies migrations and collects static files
before serving. The named volumes preserve the database, uploads, static files,
and Caddy certificates.

You can also run the update from the server shell, using the protected env file
and the server-side Compose file used by Portainer:

```sh
docker compose --env-file /protected/path/production.env -f /protected/path/compose.production.yaml pull backend frontend
docker compose --env-file /protected/path/production.env -f /protected/path/compose.production.yaml up --detach --no-build --wait
docker compose --env-file /protected/path/production.env -f /protected/path/compose.production.yaml ps
```

Use the same Compose project name and file as the Portainer stack so the
existing named volumes are reused. Do not run both Portainer and shell updates
at the same time. Check service health and the public site after each update.

To deploy a particular successful build instead of the moving `prod` tag,
change both image references in the server-side Compose file to the same
`sha-<commit>` tag, then run the pull and `up` commands above. To roll back,
select the previous known-good SHA tags for both images and repeat. Check
migration compatibility first: database migrations are not automatically
reversed, and this workflow does not make a database backup. Keep verified
[offsite backups](offsite-backups.md) and use additive migrations that support
the previous application version during the rollback window.

## Local checks

The container workflow also validates the production Compose configuration.
Run the disposable stack smoke locally with Docker and Compose:

```sh
bash .github/scripts/compose-smoke.sh
```

The GitHub build workflow publishes only from `main`, after all three checks
pass. The existing semantic-version workflow remains available for versioned
release tags.
