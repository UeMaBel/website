> Retired integration: the website now uses [aggregate-only React/Django statistics](analytics.md). This document is retained for operating or retiring historical Umami data. Do not reconnect its tracker to the website.

# Independent local Umami stack

The website's analytics service runs as an independent Compose project. It has
its own PostgreSQL 17.6 database and persistent volume. PostgreSQL is on an
internal-only network with no published port. Only Umami joins the website
proxy network; the website does not depend on Umami for startup or health.

Umami is pinned to v3.4.1's immutable multi-platform image digest:
`ghcr.io/umami-software/umami:3.4.1@sha256:e69d1a7932e9dab0fc523edc7be1f3a53f3c261f57856fc2167ae74a8fc022e8`.
The digest was read from the GHCR image index with `docker buildx imagetools
inspect`; the Linux amd64 child manifest was `sha256:f2c645cc5cdff76e7fbfe4c7eeabc7e363840bd34364f4f719b69d11f9ef1c19`. The
upstream v3.4.1 Compose file documents the `/api/heartbeat` health endpoint,
PostgreSQL setup, and two-factor encryption key. Umami's upstream v3.4.1
[Compose file](https://github.com/umami-software/umami/blob/v3.4.1/docker-compose.yml)
and [container package](https://github.com/umami-software/umami/pkgs/container/umami)
are the reference for intentional upgrades.

## Configure and start

The analytics stack joins the local website's existing proxy network. Start the
website Compose stack first so that network exists; the website remains healthy
and usable when Umami is stopped.

Copy the example environment file and generate three unrelated values. Keep the
result only in the ignored `analytics/.env` file:

```sh
cp compose.analytics.env.example analytics/.env
node -p "require('node:crypto').randomBytes(32).toString('hex')"
node -p "require('node:crypto').randomBytes(32).toString('hex')"
node -p "require('node:crypto').randomBytes(32).toString('hex')"
```

Put one output in each of `UMAMI_DB_PASSWORD`, `UMAMI_APP_SECRET`, and
`UMAMI_TWO_FACTOR_ENCRYPTION_KEY`. The last value is 64 hexadecimal characters.
Set `PROXY_NETWORK` to the website Compose project's frontend network, usually
`website_frontend`. Set `ANALYTICS_HOST` in `backend/.env` to the desired host
(default `analytics.localhost`); that setting configures the Caddy route.
Compose uses a separate project and prefixes the Umami database volume with its
project name.

Validate and start/update the service independently of the website stack:

```sh
docker compose --project-name website-analytics --env-file analytics/.env --file compose.analytics.yaml config --quiet
docker compose --project-name website-analytics --env-file analytics/.env --file compose.analytics.yaml up --detach --wait
curl -fsS -H 'Host: analytics.localhost' http://localhost:3000/api/heartbeat
```

The browser-visible dashboard is at <http://analytics.localhost:3000> (replace
`3000` with `PROXY_PORT` if the website proxy uses a different local port).
Umami seeds the initial account as `admin` / `umami`; change that password
before exposing the dashboard beyond the loopback-only local proxy. The
analytics database has no host port. Only the Umami app has access to the
shared proxy network, and only the PostgreSQL container has access to the
internal analytics database network.

The `ANALYTICS_HOST` setting in `backend/.env` configures the Caddy host route;
`PROXY_NETWORK` in `analytics/.env` selects the corresponding Docker network.
When using a non-default website Compose project name, set `PROXY_NETWORK` to
`<project-name>_frontend`. The main Compose stack has no `depends_on` or health
check requirement for Umami, so either analytics outage or maintenance leaves
the website running.

## Independent update and persistence

The image digest is intentionally immutable. Pull and recreate only the Umami
app to apply the currently reviewed image without changing the database or
website containers:

```sh
docker compose --project-name website-analytics --env-file analytics/.env --file compose.analytics.yaml pull umami
docker compose --project-name website-analytics --env-file analytics/.env --file compose.analytics.yaml up --detach --no-deps umami
```

For a future release, review its security notes and migration requirements, then
update `UMAMI_IMAGE` to that release's verified manifest-list digest. Keep the
database version, credentials, and project name stable. `up --detach` preserves
the named database volume. `down` removes containers and networks but keeps the
volume; `down --volumes` intentionally destroys analytics history.

The local repeatable persistence check is:

```sh
docker compose --project-name website-analytics --env-file analytics/.env --file compose.analytics.yaml ps
docker compose --project-name website-analytics --env-file analytics/.env --file compose.analytics.yaml restart umami
curl -fsS http://analytics.localhost:3000/api/heartbeat
docker compose --project-name website-analytics --env-file analytics/.env --file compose.analytics.yaml exec -T umami-db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "select count(*) from website;"'
```

Create a synthetic site and visit in the Umami UI before the restart; its row and
event should remain after restart or an app image update. Do not use production
data for this check. The local app was measured with `docker stats`; Compose
limits are 768 MiB / 1 CPU for Umami and 512 MiB / 0.5 CPU for PostgreSQL. Local
log rotation is capped at 10 MiB per file and three files per container.

## Data export and retention

Umami retains data indefinitely unless the operator deletes it. The project
policy is a maximum 90-day event/session retention. Ticket 56 must validate and
schedule the purge on the deployment host, and ticket58 must apply equal or
shorter retention to off-server backups before production collection begins.
The local stack does not schedule jobs or create backups.

For a reviewed Umami upgrade, recheck this purge SQL against the pinned
`prisma/schema.prisma` before running it. On the disposable local database,
repeat the transaction below to delete old event-detail rows first, then old
events, associated event data, and unreferenced old sessions while preserving
Umami users, websites, and settings:

```sql
BEGIN;
DELETE FROM event_data
WHERE website_event_id IN (
  SELECT event_id FROM website_event
  WHERE created_at IS NULL OR created_at < now() - interval '90 days'
);
DELETE FROM website_event
WHERE created_at IS NULL OR created_at < now() - interval '90 days';
DELETE FROM revenue
WHERE created_at IS NULL OR created_at < now() - interval '90 days';
DELETE FROM session_data
WHERE session_id IN (
  SELECT session_id FROM session
  WHERE created_at IS NULL OR created_at < now() - interval '90 days'
);
DELETE FROM session_link
WHERE created_at IS NULL OR created_at < now() - interval '90 days';
DELETE FROM session
WHERE (created_at IS NULL OR created_at < now() - interval '90 days')
  AND NOT EXISTS (
    SELECT 1 FROM website_event WHERE website_event.session_id = session.session_id
  )
  AND NOT EXISTS (
    SELECT 1 FROM revenue WHERE revenue.session_id = session.session_id
  );
COMMIT;
```

Back up the independent PostgreSQL database and both secret values before an
intentional service update. Restore into a disposable project and verify the
Umami app starts before applying any retention purge. Do not retain backups
beyond the approved data-retention window.
