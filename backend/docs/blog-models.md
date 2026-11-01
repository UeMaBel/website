# Blog persistence

`blog.BlogPost` stores a required Django user author (protected from deletion),
title, explicit unique slug, Markdown `body`, optional tags, draft/published
status, optional publication timestamp, and creation/update timestamps.
`blog.Tag` stores a name and unique slug. Both slug fields are required and
nonempty; slugs are supplied explicitly and never derived again on title edits.
Explicit slug history/redirects arrive in ticket 19.

New posts default to draft. Publishing requires an explicit `published_at`;
`full_clean()` gives a field validation error when it is absent, and PostgreSQL
also enforces the rule. Unknown states, missing authors, duplicate/empty slugs,
and published posts without timestamps are rejected by database constraints.
Unpublishing may retain the previous timestamp. Markdown is stored as source;
safe rendering belongs to the frontend.

Default post order is publication time descending, null timestamps last, then
primary key descending for ties. Public APIs must additionally filter by the
published state (ticket 16). Tag order is name then primary key.

## Local persistence drill

Point the documented environment at a disposable empty PostgreSQL database, then
run `uv run --frozen --env-file .env manage.py migrate --noinput`. For example,
create `website_ticket05` using your local database administrator and temporarily
override `POSTGRES_DB=website_ticket05` in the shell. This applies every migration
from scratch. Run `manage.py migrate --check`, `manage.py makemigrations --check
--dry-run`, the documented test command, and Ruff afterwards.

In `manage.py shell`, run this transaction; it rolls back the sample content:

```python
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from blog.models import BlogPost, Tag

with transaction.atomic():
    author = get_user_model().objects.create_user(username='blog-smoke')
    tag = Tag.objects.create(name='AI', slug='ai')
    post = BlogPost.objects.create(author=author, title='Original', slug='stable', body='# Markdown')
    post.tags.add(tag)
    post.title = 'Changed'
    post.save()
    post.refresh_from_db()
    assert post.slug == 'stable' and post.author == author
    assert post.body == '# Markdown' and list(post.tags.all()) == [tag]
    assert post.status == 'draft' and post.published_at is None
    post.status = 'published'
    post.published_at = timezone.now()
    post.full_clean()
    post.save()
    assert BlogPost.objects.first() == post
    transaction.set_rollback(True)
```

Run focused regression coverage with:

```sh
uv run --frozen --env-file .env manage.py test tests.test_blog_models
```

This exercises PostgreSQL constraints, protected/required authors, persisted
Markdown and tags, stable slugs, explicit publishing/unpublishing, invalid
states, and chronological ties using isolated test data.
