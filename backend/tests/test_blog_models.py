from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.db.models.deletion import ProtectedError
from django.test import TestCase
from django.utils import timezone

from blog.models import BlogPost, Tag


class BlogModelTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.author = get_user_model().objects.create_user(username='author')

    def post(self, slug='a-post', **fields):
        values = {'author': self.author, 'title': 'A post', 'slug': slug, 'body': '# Markdown'}
        values.update(fields)
        return BlogPost.objects.create(**values)

    def test_saved_post_retains_author_markdown_and_tags(self):
        post = self.post()
        tag = Tag.objects.create(name='AI', slug='ai')
        post.tags.add(tag)
        saved = BlogPost.objects.get(pk=post.pk)
        self.assertEqual(saved.author, self.author)
        self.assertEqual(saved.body, '# Markdown')
        self.assertQuerySetEqual(saved.tags.all(), [tag])

    def test_author_is_required_and_must_exist(self):
        for fields in ({'author': None}, {'author_id': 999999}):
            with self.subTest(fields=fields):
                with self.assertRaises(IntegrityError), transaction.atomic():
                    values = {'title': 'Invalid', 'slug': 'invalid', 'body': 'body'}
                    values.update(fields)
                    BlogPost.objects.create(**values)
                    # PostgreSQL foreign keys are deferred until transaction end.
                    transaction.get_connection().check_constraints()

    def test_author_cannot_be_deleted_while_credited(self):
        post = self.post()
        with self.assertRaises(ProtectedError):
            self.author.delete()
        self.assertEqual(BlogPost.objects.get(pk=post.pk).author, self.author)

    def test_title_edit_preserves_slug(self):
        post = self.post(slug='permanent-url')
        post.title = 'A completely different title'
        post.save()
        post.refresh_from_db()
        self.assertEqual(post.slug, 'permanent-url')

    def test_post_and_tag_slugs_are_unique_and_nonempty(self):
        self.post(slug='unique')
        Tag.objects.create(name='AI', slug='unique')
        for model, fields in (
            (BlogPost, {'author': self.author, 'title': 'Other', 'body': 'body'}),
            (Tag, {'name': 'Other'}),
        ):
            for slug in ('unique', ''):
                with self.subTest(model=model.__name__, slug=slug):
                    with self.assertRaises(IntegrityError), transaction.atomic():
                        model.objects.create(slug=slug, **fields)

    def test_new_post_is_draft_without_publication_timestamp(self):
        post = self.post()
        post.refresh_from_db()
        self.assertEqual(post.status, BlogPost.Status.DRAFT)
        self.assertIsNone(post.published_at)

    def test_publishing_and_unpublishing_preserve_explicit_timestamp(self):
        post = self.post()
        timestamp = timezone.now()
        post.status = BlogPost.Status.PUBLISHED
        post.published_at = timestamp
        post.full_clean()
        post.save()
        post.refresh_from_db()
        self.assertEqual(post.status, BlogPost.Status.PUBLISHED)
        self.assertEqual(post.published_at, timestamp)
        post.status = BlogPost.Status.DRAFT
        post.full_clean()
        post.save()
        post.refresh_from_db()
        self.assertEqual(post.status, BlogPost.Status.DRAFT)
        self.assertEqual(post.published_at, timestamp)

    def test_published_post_requires_timestamp_in_validation_and_database(self):
        post = BlogPost(author=self.author, title='Invalid', slug='invalid', body='body',
                        status=BlogPost.Status.PUBLISHED)
        with self.assertRaises(ValidationError) as caught:
            post.full_clean()
        self.assertIn('published_at', caught.exception.message_dict)
        with self.assertRaises(IntegrityError), transaction.atomic():
            post.save()

    def test_unknown_publication_state_is_rejected(self):
        with self.assertRaises(IntegrityError), transaction.atomic():
            self.post(status='scheduled')

    def test_chronological_order_uses_timestamp_then_id_with_drafts_last(self):
        now = timezone.now()
        draft = self.post(slug='draft')
        recent = self.post(slug='recent', status='published', published_at=now)
        older = self.post(slug='older', status='published', published_at=now - timedelta(days=1))
        tied = self.post(slug='tied', status='published', published_at=now)
        self.assertQuerySetEqual(BlogPost.objects.all(), [tied, recent, older, draft])
