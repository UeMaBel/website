# Public API contract

API URLs are versioned under `/api/v1/` and use trailing slashes. This contract
will be extended by each API ticket before frontend integration.

## Health

`GET /api/v1/health/` is public, without authentication or request parameters.
It returns HTTP 200, `Content-Type: application/json`, and exactly:

```json
{"status": "ok"}
```

This is a process-liveness signal. It does not query PostgreSQL or other services
and does not claim database readiness. It reveals no dependency versions,
configuration, hostnames, credentials, or exception details. There is no
pagination. `HEAD` returns HTTP 200 with no response body. Other methods return
HTTP 405 and `Allow: GET, HEAD`; the framework's response body is empty.
Invalid paths return HTTP 404 using Django's standard error response. Configure
`DJANGO_DEBUG=false` outside local development to suppress Django debug pages.

## Repeatable local verification

From `backend/` with the documented local `.env`:

```sh
uv run --frozen --env-file .env manage.py shell -c "from django.test import Client; c=Client(enforce_csrf_checks=True, HTTP_HOST='localhost'); r=c.get('/api/v1/health/'); assert r.status_code == 200; assert r.headers['Content-Type'] == 'application/json'; assert r.json() == {'status': 'ok'}; h=c.head('/api/v1/health/'); assert h.status_code == 200 and h.content == b''; p=c.post('/api/v1/health/'); assert p.status_code == 405; assert p.headers['Allow'] == 'GET, HEAD'; assert p.content == b''; print('health contract passed')"
```

For an actual HTTP smoke check, start the documented development server and run
`curl -i http://127.0.0.1:8000/api/v1/health/`.
