# Django backend

Requires Python 3.14, [uv](https://docs.astral.sh/uv/), and PostgreSQL 14 or newer.
Run commands from `backend/`.

## Local configuration

Copy `.env.example` to `.env` (ignored by Git). Set `DJANGO_SECRET_KEY` to a
random local value, for example the output of:

```sh
uv run --frozen python -c "import secrets; print(secrets.token_urlsafe(50))"
```

Set `POSTGRES_PASSWORD` to your local PostgreSQL role's password. The example
contains no secrets. Never commit `.env`. Shell environment values take precedence
when using uv's explicit `--env-file .env` option; Django itself reads only the
environment and does not automatically load files.

`POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_HOST`, and `POSTGRES_PORT` default to
`website`, `website`, `127.0.0.1`, and `5432`. The password defaults to empty so
local socket/password-file authentication remains possible. Missing or empty
`DJANGO_SECRET_KEY` fails immediately. Debug defaults to false; only the value
`true` (case-insensitive) enables it. `DJANGO_ALLOWED_HOSTS` is a comma-separated
list and defaults to empty. `.env.example` enables local development explicitly.

Create the database and role using your local PostgreSQL administrator, or use a
throwaway local Docker database. With the filled `.env` file:

```sh
docker run --detach --name website-postgres --env-file .env --publish 127.0.0.1:5432:5432 postgres:17
uv sync --frozen
uv run --frozen --env-file .env manage.py migrate
uv run --frozen --env-file .env manage.py runserver 127.0.0.1:8000
```

The Docker command is for disposable local data only; persistent volumes and
Compose are later infrastructure tickets. Match the published host port to
`POSTGRES_PORT` if the default is occupied. Stop the server with Ctrl+C.
The admin login is at `/admin/`; create a local account with
`uv run --frozen --env-file .env manage.py createsuperuser` when needed.
No production or external credentials are needed for local development.

## Verification

```sh
uv run --frozen python -m unittest tests.test_settings
uv run --frozen ruff check .
uv run --frozen --env-file .env manage.py check
uv run --frozen --env-file .env manage.py migrate --check
uv run --frozen --env-file .env manage.py test
```

The environment tests exercise the settings interface in isolated processes,
including missing secrets, configured PostgreSQL fields, debug, and allowed
hosts. `migrate` followed by `migrate --check` proves connectivity and applied
migrations against PostgreSQL, rather than falling back to SQLite. The Django test runner also exercises the public health contract (GET, HEAD,
and rejected unsafe methods with CSRF enforcement), asserts zero database queries
for health, and creates/destroys an isolated PostgreSQL `test_<POSTGRES_DB>`
database. The local database role needs CREATEDB; use a dedicated local database
role, never production credentials. Django isolates each database-backed test in
transactions and does not use development content as fixtures. The environment
regression tests run in subprocesses without touching the database.

`uv sync --frozen` includes the pinned development Ruff dependency. The lint
command checks syntax, unused/undefined names, and core Python errors; it does
not rewrite files. Run commands from `backend/`. CI automation is ticket 60.
[Ruff configuration](https://docs.astral.sh/ruff/configuration/) documents the
explicit rule set in `pyproject.toml`.
A startup smoke check with debug enabled requests `/` and expects HTTP 200 and
the Django installation-success page.

## Dependency choices

Django 5.2.18 LTS and Python 3.14 remain pinned from ticket 01. Psycopg 3.3.6
uses its binary distribution for local development without a compiler or system
libpq installation. `uv.lock` pins transitive dependencies.

- [Django Python support](https://docs.djangoproject.com/en/5.2/faq/install/)
- [Django support dates](https://www.djangoproject.com/download/)
- [Psycopg binary installation](https://www.psycopg.org/psycopg3/docs/basic/install.html)

Production serving, hardened security settings, persistence, and deployment are
later tickets. No hosting is provisioned here.

The versioned [API contract](docs/api.md) documents endpoint behavior and smoke checks.
