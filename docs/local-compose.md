# Local Compose stack

Docker Compose runs the Next.js frontend, Django backend, and PostgreSQL for
local development. PostgreSQL has no published host port and uses a private
network. Named volumes preserve PostgreSQL data and uploaded media across
container rebuilds and restarts.

## Configure and start

From the repository root, copy the Compose example to the backend's ignored
local environment file and set fresh values for `DJANGO_SECRET_KEY` and
`POSTGRES_PASSWORD`. Generate them separately with Python; do not reuse
production values:

```sh
cp compose.env.example backend/.env
python -c "import secrets; print(secrets.token_urlsafe(50))"
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

Paste the outputs into `backend/.env`, which is ignored by
`backend/.gitignore`. Then start the stack and wait for all health checks:

```sh
docker compose --env-file backend/.env up --build --wait --wait-timeout 180
```

Compose waits for PostgreSQL readiness before starting Django. The backend
applies migrations before launching Gunicorn; its health check passes when the
backend liveness endpoint responds. The frontend starts after the backend is
healthy and has its own backend-independent `robots.txt` health check.

## Shared local origin and demo hostname

Caddy 2.10.2 is the shared HTTP reverse proxy. Only the proxy publishes a host
port, bound to loopback. The website, Django admin, versioned API, Django static
paths, and uploaded-media paths use that same browser origin. Admin HTML and API
requests go to Django; collected static assets and uploaded media are served by
Caddy from read-only mounts. All other website paths go to Next.js.
This lets browser admin sessions use the same host and port as the draft-preview
route. The backend and PostgreSQL no longer publish host ports.

Local endpoints:

- Website: <http://localhost:3000>
- Django admin: <http://localhost:3000/admin/>
- Backend liveness: <http://localhost:3000/api/v1/health/>
- Frontend liveness: <http://localhost:3000/robots.txt>
- Django static paths: <http://localhost:3000/static/>
- Uploaded media paths: <http://localhost:3000/media/>
- Isolated demo fixture: <http://demo.localhost:3000>

The demo hostname routes to a small read-only Nginx fixture. It shares only the
proxy's dedicated `demo_proxy` network and has no database. PostgreSQL remains
on its internal database network, which the demo service cannot join. Replace
the `demo` service and fixture with an independent project service when needed;
keep its database private to that project's own network.

The proxy forwards `/api/`, `/admin`, and `/admin/*` to Django while preserving
the request host and cookies. On backend start, Compose runs `collectstatic`
into a persistent named volume. Caddy serves `/static/*` from that volume and
`/media/*` from the backend's persistent media volume, mounted read-only. Media
is served as files, never executed; responses include `nosniff` and a restrictive
content security policy, and PDFs download as attachments. Django accepts files
up to 10 MiB; Caddy limits the complete multipart upload request to 11 MiB so
the request can include form and CSRF fields while bounding proxy/backend input.
Set `DJANGO_UPLOAD_MAX_BYTES` and `UPLOAD_REQUEST_MAX_SIZE` together if changing
the defaults; leave room for multipart overhead above the file limit.

After uploading a PNG and PDF in Django admin, check their response headers and
verify that the files still load after restarting the backend and proxy:

```sh
curl -fsSI http://localhost:3000/static/admin/css/base.css
curl -fsSI http://localhost:3000/media/uploads/<stored-image-name>.png
curl -fsSI http://localhost:3000/media/uploads/<stored-cv-name>.pdf
docker compose --env-file backend/.env restart backend proxy
```

The static and media paths must remain available after restart. The PDF response
must include `Content-Disposition: attachment`; media responses include
`X-Content-Type-Options: nosniff`.

Create the first administrator interactively:

```sh
docker compose --env-file backend/.env exec backend python manage.py createsuperuser
```

This command prompts for the local admin identity and password and can be run
again to create additional administrators. The Compose stack does not contain
or generate an admin account.

Admin and preview navigation now stays on `http://localhost:3000`, so the
Django session cookie is available to the frontend preview route on the same
host.

Repeat the shared-origin and isolated-demo checks after startup:

```sh
curl -fsS http://localhost:3000/robots.txt
curl -fsS http://localhost:3000/api/v1/health/
curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:3000/admin/login/
curl -fsS --resolve demo.localhost:3000:127.0.0.1 http://demo.localhost:3000/
docker network inspect website_database
docker network inspect website_demo_proxy
```

The admin login should return 200, and the `demo_proxy` network should contain
only the proxy and demo service. The database network is internal and contains
only PostgreSQL and Django; neither database nor backend has a published host
port. For the session journey, log into Django at `/admin/`, open a draft's
change page, follow **Preview draft**, and confirm the preview renders while
still on `localhost:3000`.

## Repeatable verification and data lifecycle

After startup, check readiness and that migrations are applied:

```sh
docker compose --env-file backend/.env ps
docker compose --env-file backend/.env exec backend python manage.py migrate --check
```

`docker compose --env-file backend/.env up --build --wait` is safe to repeat;
Django runs the migration command before each backend start. To stop and remove
containers while retaining named database and media volumes, run:

```sh
docker compose --env-file backend/.env down
```

To intentionally delete local database and uploaded media, run:

```sh
docker compose --env-file backend/.env down --volumes
```

The default `PROXY_PORT` and `PUBLIC_SITE_ORIGIN` can be overridden in
`backend/.env` if the local port is occupied. Set `PUBLIC_SITE_ORIGIN` to the
browser-visible website origin, including a non-default port when used. With a
custom `PROXY_PORT`, include that port in the `--resolve` and URL values above.
