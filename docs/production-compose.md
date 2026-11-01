# Production Compose configuration

`compose.production.yaml` describes the single host production stack. It does
not provision a server, DNS, firewall, backups, or credentials. Set those up
separately before starting the stack.

## Required inputs

Create a protected environment file outside this repository from
`production.env.example`. Set:

- `SITE_DOMAIN` to the public DNS name that resolves to this host.
- `DJANGO_SECRET_KEY` to a fresh, randomly generated Django secret.
- `POSTGRES_PASSWORD` to a fresh database password.
- `POSTGRES_DB` and `POSTGRES_USER` to the chosen database and role names.

The production configuration sets Django's debug mode off, trusts the
`X-Forwarded-Proto` value from Caddy, marks session and CSRF cookies secure,
trusts the configured HTTPS origin for CSRF, and enables a one-year HSTS
policy. Django accepts only the configured public site domain and the internal
`backend` service name used for private frontend API requests. Caddy is the
only published ingress and automatically redirects HTTP to HTTPS. Django's
own redirect stays disabled so server-side frontend requests can use the
private HTTP backend URL. Browser traffic enters through Caddy, and the
backend has no published port. Uploaded files use the persistent
`DJANGO_MEDIA_ROOT` volume. Django's `DJANGO_STATIC_ROOT` is configurable for
the static file serving layer, which is documented separately.

Keep the environment file readable only by the deployment operator. Do not
commit it or reuse development credentials. The checked-in example contains
empty required secrets, and Compose stops with an error until they are set.

Generate independent secret values with Python, then write them only into the
protected environment file:

```sh
python -c "import secrets; print(secrets.token_urlsafe(50))"
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

The DNS record must point to the host, and inbound TCP ports 80 and 443 must
reach Caddy. Caddy obtains and renews HTTPS certificates automatically for the
configured site domain. The configuration publishes only those proxy ports;
PostgreSQL, Django, and Next.js have no host-published ports.

## Start and inspect

From the repository root, substitute the protected environment file's path:

```sh
docker compose --env-file /protected/path/website-production.env -f compose.production.yaml config --quiet
docker compose --env-file /protected/path/website-production.env -f compose.production.yaml up --build --detach --wait
docker compose --env-file /protected/path/website-production.env -f compose.production.yaml ps
docker compose --env-file /protected/path/website-production.env -f compose.production.yaml exec backend python manage.py migrate --check
```

The backend waits for PostgreSQL readiness, applies migrations before serving,
and exposes a health check. The proxy starts after the backend and frontend
are healthy. Use Django's interactive command to create the first administrator:

```sh
docker compose --env-file /protected/path/website-production.env -f compose.production.yaml exec backend python manage.py createsuperuser
```

Database files, uploaded media, and Caddy certificate/configuration data use
named volumes so they persist when containers are replaced. The Compose file
sets restart policies, CPU and memory limits, health checks, and bounded
JSON-file logs for each service. PostgreSQL joins only the private internal
database network. Django joins that network and the application network; the
frontend and Caddy join only the application network. Only Caddy publishes
host ports.

Settings contract: `DJANGO_STATIC_ROOT` sets the directory
filled by `collectstatic`; `DJANGO_TRUST_X_FORWARDED_PROTO` enables Django's
trusted proxy scheme handling; `DJANGO_SECURE_SSL_REDIRECT`,
`DJANGO_SESSION_COOKIE_SECURE`, `DJANGO_CSRF_COOKIE_SECURE`,
`DJANGO_CSRF_TRUSTED_ORIGINS`, and `DJANGO_SECURE_HSTS_SECONDS` control HTTPS
behavior. Local HTTP setups leave these values off or unset. Production enables
proxy trust, secure cookies, trusted origins, and HSTS; Caddy owns the public
HTTP-to-HTTPS redirect, while Django keeps its redirect disabled for internal
frontend-to-backend HTTP requests.

## Stop and preserve data

Stop the services while preserving database, media, and certificate volumes:

```sh
docker compose --env-file /protected/path/website-production.env -f compose.production.yaml down
```

Removing volumes deletes the database, uploaded files, and Caddy's stored
certificate state. Ensure separately managed backups are available before
doing so. Off-host backups and restore drills are operational requirements and
are not performed by this Compose configuration.
