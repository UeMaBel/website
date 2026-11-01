# Django backend

Requires Python 3.14 and [uv](https://docs.astral.sh/uv/). Run from `backend/`:

```sh
uv sync --frozen
uv run --frozen manage.py migrate
uv run --frozen manage.py runserver 127.0.0.1:8000
```

Visit <http://127.0.0.1:8000/> for the Django welcome page. Stop with Ctrl+C.
The admin login is at `/admin/`; create a local account with
`uv run --frozen manage.py createsuperuser` when needed.

## Verification

```sh
uv run --frozen manage.py check
uv run --frozen manage.py test
```

For a startup smoke check, start the development server above and request `/`
with a browser or `curl http://127.0.0.1:8000/`: expect HTTP 200 and the Django
installation-success page. The test command currently discovers zero project
tests; focused application tests arrive with the relevant tickets.

## Scope and dependency choices

This initial scaffold uses Django 5.2 LTS, pinned to 5.2.18. `uv.lock` pins all
transitive dependencies. Python 3.14 is selected in `.python-version` and
`pyproject.toml`. Django documents Python 3.14 support from 5.2.8:
<https://docs.djangoproject.com/en/5.2/faq/install/>. The 5.2 LTS series receives
security support through April 2028: <https://www.djangoproject.com/download/>.

These are local development settings: debug is enabled, the placeholder secret
key is public, and the database is a local ignored SQLite file. No external
service or credentials are required for this scaffold. Ticket 02 replaces the
database/settings with environment-configured PostgreSQL. Production serving,
security configuration, and deployment are later tickets.
