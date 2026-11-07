# Automatic delivery with Portainer

Merging into `main` runs **Deliver to Portainer**: Django checks, React/Next.js
checks, and the disposable Compose integration smoke must all succeed. Actions
then builds and publishes both production images to GHCR with `sha-<commit>`
tags. Only after both pushes succeed does it update the existing Portainer stack
with immutable image digests. Portainer pulls the images and recreates changed
containers; migrations and static collection run before Django starts. Named
volumes preserve PostgreSQL, uploads, static assets, and Caddy certificates.

This uses the [Portainer stack update API](https://api-docs.portainer.io/),
including `Env`, `StackFileContent`, `PullImage` and `Prune`. It works with a
file/web-editor Docker Standalone stack in Community Edition. Stack webhooks
[require Business Edition](https://docs.portainer.io/user/docker/stacks/webhooks).
There is no SSH deployment credential or build toolchain on the server.

## One-time setup

1. Prepare an **amd64 Linux** server with Docker Engine and a current Compose
   plugin (supporting `!reset` and inline `configs.content`), and install
   Portainer. Configure DNS and allow public TCP 80/443 to reach Caddy. Keep
   Portainer HTTPS management access restricted to trusted operators and your
   deployment runner. A self-hosted runner on the management network works if
   GitHub-hosted runners cannot reach it. Use a trusted TLS certificate.
2. Enable Actions package writes. Make the GHCR packages public, or configure
   a GHCR registry with a read-only `read:packages` credential in Portainer and
   grant access to the deployment user/environment. Confirm both packages can
   be pulled there. The workflow's `GITHUB_TOKEN` is used only to publish.
3. Before enabling deployment, run **Deliver to Portainer** once to publish
   images (its deploy job will fail until setup is complete). Copy both image
   digests from the build logs. Render the stack locally:

   ```sh
   docker compose -f compose.production.yaml -f compose.portainer.yaml config --no-interpolate > portainer-stack.yaml
   ```

   The rendered file contains variable placeholders, never production secrets.
   Do not commit this generated file. In Portainer, choose **Stacks → Add stack
   → Web editor**. Name it exactly `personal-website-production` and paste the
   rendered file. Set stack environment variables using `production.env.example`
   as the template, plus `BACKEND_IMAGE` and `FRONTEND_IMAGE` containing the full
   `ghcr.io/<owner>/personal-website-<service>@sha256:<digest>` references.
   Deploy the stack. Portainer stores the production secrets; Actions preserves
   them in memory when updating the stack and never writes them to an artifact.
4. Create a dedicated Portainer deployment user's API key with access to that
   stack and environment. Note the stack ID and environment (endpoint) ID.
   Add these to the GitHub **production** environment:

   | Kind | Name | Value |
   | --- | --- | --- |
   | Secret | `PORTAINER_API_KEY` | Deployment user's API key |
   | Variable | `PORTAINER_URL` | HTTPS management origin, e.g. `https://portainer.example.com:9443` |
   | Variable | `PORTAINER_STACK_ID` | Numeric stack ID |
   | Variable | `PORTAINER_ENDPOINT_ID` | Numeric Docker environment ID |

5. Restrict the GitHub environment to `main`. For fully automatic delivery,
   disable required environment reviewers. Protect `main` with reviews and
   required CI checks. Dispatch **Deliver to Portainer** on `main` to verify the
   complete path, then subsequent merges deploy automatically.

Do not run the legacy SSH deployment workflow against this Portainer-managed
stack. Existing installations must back up and confirm volume ownership/names
before moving management to Portainer; creating another stack name can attach
empty volumes or conflict with the live stack's ports.

## Readiness, failures, and rollback

The pipeline serializes publication/deployment and skips superseded commits
before deployment. It checks the two running image references match the requested
digests, waits up to five minutes for PostgreSQL, Django, React, and Caddy health,
then probes public HTTPS API readiness, robots, and Django admin CSS. A failed
push prevents deployment. API timeout or failed readiness fails Actions; inspect
Portainer to determine the actual running state before retrying. Updates can
briefly interrupt service; this single-host Compose deployment is not zero downtime.

Automatic deployment does not take a database backup or restore schema on
failure. Configure and verify scheduled [offsite backups](offsite-backups.md)
before enabling it. Use additive, backward-compatible migrations; review
destructive changes separately. There is no automatic rollback after migrations.
To roll back application code, set both image environment variables to the prior
known-good digests in Portainer and redeploy with image pulling enabled. Confirm
schema compatibility first; follow [backup/restore](backup-restore.md) when data
recovery is needed. Reverting the offending commit on `main` deploys the reverted
code through the same checks. Retain previous GHCR digests for the rollback window.

The semantic-version publishing and manual SSH workflows remain available for
the separately documented legacy deployment path. `sha-*` images are deployed
by digest, so rebuilding a commit cannot change an already running release.

## Local validation

```sh
python -B .github/scripts/test_deploy_portainer.py
docker compose -f compose.production.yaml -f compose.portainer.yaml config --no-interpolate --quiet
```

These checks require no deployment credentials. The controller tests cover
credential preservation, both image updates, wrong endpoint/Git stack rejection,
mutable-tag rejection, and refusing to report an old running image as ready.
Live registry access, Portainer permissions, container replacement, and public
TLS readiness require the configured server and a real pipeline run.
