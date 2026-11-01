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

Local endpoints:

- Website: <http://localhost:3000>
- Django admin: <http://localhost:8000/admin/>
- Backend liveness: <http://localhost:8000/api/v1/health/>
- Frontend liveness: <http://localhost:3000/robots.txt>

Create the first administrator interactively:

```sh
docker compose --env-file backend/.env exec backend python manage.py createsuperuser
```

This command prompts for the local admin identity and password and can be run
again to create additional administrators. The Compose stack does not contain
or generate an admin account.

The frontend and Django admin currently use separate local ports. Ticket 49
adds the same-origin reverse proxy needed for the admin preview link to work
through one origin.

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

The default `FRONTEND_PORT`, `BACKEND_PORT`, and `PUBLIC_SITE_ORIGIN` can be
overridden in `backend/.env` if those local ports are occupied. Set
`PUBLIC_SITE_ORIGIN` to the browser-visible frontend origin, including a
non-default port when used.
