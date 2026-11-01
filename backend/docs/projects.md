# Project persistence

The `projects` app stores each project with a unique, explicit slug, title,
Markdown problem and contribution, a JSON list of technology names, optional
Markdown description, and optional HTTP or HTTPS repository and demo URLs.
Titles do not regenerate slugs after edits. Projects can exist without either
link or any images.

`ProjectImage` links projects to uploaded image media. Its records are exposed
through `project.project_images` and store an independent nonnegative position,
sorting by position then primary key for stable ties. A project cannot link the
same upload twice. PDF uploads are not valid project images, and referenced
uploads are protected from deletion.

## Persistence drill

Create a disposable empty PostgreSQL database and point `POSTGRES_DB` at it;
then apply all migrations with `uv run --frozen --env-file .env manage.py
migrate --noinput`. Run `manage.py migrate --check` and
`manage.py makemigrations --check --dry-run` afterwards. Run the focused project
model regression suite with `uv run --frozen --env-file .env manage.py test
tests.test_projects`.

In `manage.py shell`, create a project with problem, contribution, technology
names and a stable slug, change its title, attach uploaded image records at
different positions, reload it and verify the slug and image ordering. Verify
the optional links and image collection can be empty. Roll back the sample rows
inside `transaction.atomic()` with `transaction.set_rollback(True)`.

Run backend checks from `backend/` with `uv run --frozen ruff check .`,
`uv run --frozen --env-file .env manage.py check`, and
`uv run --frozen --env-file .env manage.py test`.
