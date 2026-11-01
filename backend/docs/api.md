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

## Public About/CV and contact

`GET /api/v1/profile/` is public and accepts no query parameters. It returns the
owner's display name, Markdown biography, contact email and links, optional CV
URL, experience, education, and skills. Structured entries are ordered by
`position`, then primary key. Dates use `YYYY-MM-DD`; open-ended entries have a
null `end_date`. Markdown values are returned as source text for safe frontend
rendering. `cv_url` is the media URL returned by the configured file
storage, or `null` when no CV is attached.

The endpoint always returns the same fields. If the owner profile does not
exist, text fields are empty strings, `cv_url` is `null`, and every collection
is an empty array. A saved but otherwise empty profile has the same public
representation.

Example response:

```json
{
  "display_name": "Site Owner",
  "biography": "Experienced engineer.\n\nFocused on AI systems.",
  "email": "hello@example.test",
  "cv_url": "/media/uploads/cv.pdf",
  "experience": [
    {
      "position": 0,
      "employer": "Example Co",
      "role": "Software Engineer",
      "start_date": "2022-01-01",
      "end_date": null,
      "description": "Built production systems."
    }
  ],
  "education": [],
  "skills": [{"position": 0, "name": "Python", "category": "Languages"}],
  "links": [{"position": 0, "label": "Professional profile", "url": "https://example.test/owner"}]
}
```

`HEAD` is allowed and returns no body. Other methods return HTTP 405. A request
with any query parameter returns HTTP 400 with
`{"detail":"This endpoint does not accept query parameters."}`. Invalid paths
use Django's standard HTTP 404 response.

Run this empty-state check against a disposable clean database after migrations;
it expects that no profile has been created yet.

```sh
uv run --frozen --env-file .env manage.py shell -c "from django.test import Client; c=Client(HTTP_HOST='localhost'); r=c.get('/api/v1/profile/'); assert r.status_code == 200 and r.headers['Content-Type'] == 'application/json'; data=r.json(); assert set(data) == {'display_name', 'biography', 'email', 'cv_url', 'experience', 'education', 'skills', 'links'}; assert data['display_name'] == data['biography'] == data['email'] == ''; assert data['cv_url'] is None and all(data[name] == [] for name in ('experience', 'education', 'skills', 'links')); assert c.head('/api/v1/profile/').content == b''; assert c.get('/api/v1/profile/?unexpected=1').status_code == 400; assert c.post('/api/v1/profile/').status_code == 405; print('profile contract passed')"
```


## Public blog listing

`GET /api/v1/blog/posts/` is public and accepts `page` and `page_size` query
parameters. `page` defaults to 1. `page_size` defaults to 10 and must be between
1 and 100. The optional `tag` parameter filters results by tag slug. Other
query parameters are rejected.

The endpoint returns only published posts, ordered by publication time
descending and then primary key descending. Drafts are never included. Tags are
ordered by name, then primary key. The response does not include Markdown body
content; that belongs to the post detail endpoint.

For example, `GET /api/v1/blog/posts/?page=1&page_size=2` returns HTTP 200:

```json
{
  "count": 3,
  "next": "/api/v1/blog/posts/?page=2&page_size=2",
  "previous": null,
  "results": [
    {
      "slug": "latest-post",
      "title": "Latest post",
      "published_at": "2026-11-01T12:00:00+00:00",
      "author": {"username": "owner", "name": "Site Owner"},
      "tags": [{"name": "AI", "slug": "ai"}]
    },
    {
      "slug": "older-post",
      "title": "Older post",
      "published_at": "2026-10-31T12:00:00+00:00",
      "author": {"username": "owner", "name": "Site Owner"},
      "tags": []
    }
  ]
}
```

`count` is the total number of published posts. `next` and `previous` are
relative URLs or `null` when there is no adjacent page. An empty listing is
HTTP 200 with `count: 0`, empty `results`, and null links. A malformed or
nonpositive `page`, a `page_size` outside 1–100, or an unsupported query
parameter returns HTTP 400 with `{"detail":"..."}`. A positive page beyond
the last available page returns HTTP 404 with `{"detail":"Page not found."}`.
The `tag` parameter must be non-empty. A tag with no published posts or an
unknown tag slug returns HTTP 404 with `{"detail":"Not found."}`. Pagination
links retain the selected tag filter.
`HEAD` is allowed without a response body; other methods receive HTTP 405.

`GET /api/v1/blog/posts/<slug>/` returns the published post matching its slug,
using the listing fields and adding `body` with the Markdown source. A missing
slug and a draft post both return HTTP 404 with the same
`{"detail":"Not found."}` response. The endpoint is public and accepts no
query parameters.

`GET /api/v1/blog/tags/` returns tags that are attached to at least one
published post, ordered by name then primary key. Each result has `slug`,
`name`, and `post_count` for published posts only. The response is
`{"count": <tag count>, "results": [...]}`. Tags used only by drafts are not
exposed. This endpoint accepts no query parameters; otherwise it returns HTTP
400 with `{"detail":"This endpoint does not accept query parameters."}`.
Both endpoints allow `HEAD` without a response body and return HTTP 405 for
other methods.

Repeatable smoke check against the configured database:

```sh
uv run --frozen --env-file .env manage.py shell -c "from django.test import Client; c=Client(HTTP_HOST='localhost'); r=c.get('/api/v1/blog/posts/?page=1&page_size=2'); assert r.status_code == 200 and r.headers['Content-Type'] == 'application/json'; assert set(r.json()) == {'count', 'next', 'previous', 'results'}; assert all(item['author']['username'] and isinstance(item['tags'], list) for item in r.json()['results']); bad=c.get('/api/v1/blog/posts/?page=0'); assert bad.status_code == 400; missing=c.get('/api/v1/blog/posts/?page=999999'); assert missing.status_code == 404; print('blog listing contract passed')"
```

For populated data, also request a known published slug at
`/api/v1/blog/posts/<slug>/` and assert the `body` field is present. Request
`/api/v1/blog/tags/` and
`/api/v1/blog/posts/?tag=<published-tag-slug>` to verify tag navigation and
filtering. A draft or unknown slug must return HTTP 404.

## Public projects

`GET /api/v1/projects/` returns all projects in title ascending, then primary-key
order. It is public and does not paginate. The response has `count` and
`results`. Each project has the same shape as its detail response:

```json
{
  "count": 1,
  "results": [
    {
      "slug": "sample-project",
      "title": "Sample project",
      "problem": "The problem in Markdown.",
      "contribution": "The owner contribution in Markdown.",
      "technologies": ["Django", "PostgreSQL"],
      "description": "Additional Markdown details.",
      "repository_url": "https://example.test/source",
      "demo_url": null,
      "images": [
        {"position": 0, "url": "/media/uploads/project.png", "alt_text": "Project screenshot"}
      ]
    }
  ]
}
```

Markdown values are returned as source text for safe frontend rendering.
`repository_url` and `demo_url` are absolute URLs or `null` when absent. `images`
is always an array ordered by position, then primary key; each image includes
its media URL, descriptive alternative text, and position. A project with no
optional links or images returns `null` links and an empty `images` array. An
empty project collection returns HTTP 200 with `count: 0` and empty `results`.

`GET /api/v1/projects/<slug>/` returns one project in the same shape as a list
item. A missing slug returns HTTP 404 with `{"detail":"Not found."}`. Both
endpoints are public, accept no query parameters, allow `HEAD` without a body,
and return HTTP 405 for other methods. Query parameters return HTTP 400 with
`{"detail":"This endpoint does not accept query parameters."}`.

Repeatable smoke check against the configured database:

```sh
uv run --frozen --env-file .env manage.py shell -c "from django.test import Client; c=Client(HTTP_HOST='localhost'); r=c.get('/api/v1/projects/'); assert r.status_code == 200 and r.headers['Content-Type'] == 'application/json'; data=r.json(); assert set(data) == {'count', 'results'} and data['count'] == len(data['results']); assert all(set(project) == {'slug', 'title', 'problem', 'contribution', 'technologies', 'description', 'repository_url', 'demo_url', 'images'} for project in data['results']); missing=c.get('/api/v1/projects/not-a-project/'); assert missing.status_code == 404 and missing.json() == {'detail': 'Not found.'}; assert c.get('/api/v1/projects/?unexpected=1').status_code == 400; print('project API contract passed')"
```


Run the focused PostgreSQL-backed regression suite from `backend/` with:

```sh
uv run --frozen --env-file .env manage.py test tests.test_blog_api
```

## Repeatable local verification

From `backend/` with the documented local `.env`:

```sh
uv run --frozen --env-file .env manage.py shell -c "from django.test import Client; c=Client(enforce_csrf_checks=True, HTTP_HOST='localhost'); r=c.get('/api/v1/health/'); assert r.status_code == 200; assert r.headers['Content-Type'] == 'application/json'; assert r.json() == {'status': 'ok'}; h=c.head('/api/v1/health/'); assert h.status_code == 200 and h.content == b''; p=c.post('/api/v1/health/'); assert p.status_code == 405; assert p.headers['Allow'] == 'GET, HEAD'; assert p.content == b''; print('health contract passed')"
```

For an actual HTTP smoke check, start the documented development server and run
`curl -i http://127.0.0.1:8000/api/v1/health/`.
