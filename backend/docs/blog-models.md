# Blog persistence

`blog.BlogPost` stores a required Django user author (protected from deletion),
title, explicit unique slug, Markdown `body`, optional tags, draft/published
status, optional publication timestamp, and creation/update timestamps.
`blog.Tag` stores a name and unique slug. Both slug fields are required and
nonempty; slugs are supplied explicitly and never derived again on title edits.

Every current and previously used post slug is reserved in `BlogPostSlug`. An
explicit slug edit atomically marks the old slug historical and reserves the
new canonical slug. A unique reservation prevents collisions with current or
historical URLs; a post cannot reuse one of its own previous slugs, which
prevents redirect cycles. Existing post slugs are reserved by the migration.
The public detail API permanently redirects an old published URL directly to
the current canonical slug. If the post is a draft, old URLs remain private
and return 404. See the public API contract for redirect behavior.

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

For a repeatable slug-history smoke check, in `manage.py shell` create and
publish a post at slug `first`, save it again with slug `second`, and request
`/api/v1/blog/posts/first/` with Django's test client. It must return HTTP 301
with `Location: /api/v1/blog/posts/second/`. Rename the post to `third` and
verify both `first` and `second` redirect directly to `third`. Attempting to
assign `first` to another post or restore it on the original post must fail.

## Blog administration

Log in at `/admin/` with an active staff account granted the blog post/tag
view/add/change permissions (or a local superuser). Staff status alone does not
grant content access. Anonymous users are redirected to login; staff lacking
model permissions receive HTTP 403.

- Add/edit tags under Blog > Tags.
- Add a post under Blog > Blog posts. Assign the author, enter plain Markdown,
  and select tags. Slug is suggested from the title only on the add screen;
  edit forms retain the existing slug when the title changes.
- New posts start as drafts. The explicit **Publish selected posts** action sets
  the published state and fills a missing publication timestamp with now.
  Existing publication timestamps are retained.
- Draft edit forms include a **Preview draft** action linking to the relative
  same-origin frontend route `/blog/<slug>/preview`. The frontend uses the
  existing admin session cookie; the link contains no token and creates no
  public preview URL.
- **Unpublish selected posts** returns them to draft, retaining the timestamp.
  These actions require change permission. A single edit form can also set
  status and publication timestamp explicitly; publishing without a timestamp
  shows a field validation error.

Repeatable manual check: create a local staff user with these permissions, log
in, create/edit a tag, add a draft with an author and tag, edit its title, and
confirm its slug is unchanged. Use both actions and reopen the form after each
to confirm saved state/timestamp. Log out and confirm the content admin requires
login; repeat with staff lacking permissions to confirm access is denied.
The HTTP smoke drill for ticket 07 used a real non-superuser staff account,
admin POSTs for each operation, and refreshed persisted objects after saves;
all temporary content was rolled back.
