from datetime import timedelta

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.test import Client, TestCase
from django.utils import timezone

from blog.models import BlogPost, Tag


class PublicBlogApiTests(TestCase):
    def setUp(self):
        self.author = get_user_model().objects.create_user(
            username='owner', first_name='Site', last_name='Owner',
        )
        self.ai = Tag.objects.create(name='AI', slug='ai')
        self.python = Tag.objects.create(name='Python', slug='python')
        self.draft_tag = Tag.objects.create(name='Draft topic', slug='draft-topic')
        self.client = Client(enforce_csrf_checks=True, HTTP_HOST='localhost')

    def post(self, slug, published_at=None, status=BlogPost.Status.PUBLISHED, **fields):
        values = {
            'slug': slug,
            'title': slug.replace('-', ' ').title(),
            'author': self.author,
            'body': f'# {slug}',
            'status': status,
            'published_at': published_at or timezone.now(),
        }
        values.update(fields)
        return BlogPost.objects.create(**values)

    def test_listing_paginates_published_posts_in_reverse_chronological_order(self):
        now = timezone.now()
        older = self.post('older', now - timedelta(days=1))
        first_tie = self.post('first-tie', now)
        first_tie.tags.add(self.python, self.ai)
        second_tie = self.post('second-tie', now)
        draft = self.post(
            'future-draft', now + timedelta(days=1), status=BlogPost.Status.DRAFT,
        )
        draft.tags.add(self.draft_tag)

        first = self.client.get('/api/v1/blog/posts/?page=1&page_size=2')
        self.assertEqual(first.status_code, 200)
        payload = first.json()
        self.assertEqual(payload['count'], 3)
        self.assertEqual(
            [item['slug'] for item in payload['results']],
            [second_tie.slug, first_tie.slug],
        )
        self.assertEqual(payload['next'], '/api/v1/blog/posts/?page=2&page_size=2')
        self.assertIsNone(payload['previous'])
        self.assertEqual(payload['results'][1]['author'], {
            'username': 'owner', 'name': 'Site Owner',
        })
        self.assertEqual(payload['results'][1]['tags'], [
            {'name': 'AI', 'slug': 'ai'}, {'name': 'Python', 'slug': 'python'},
        ])
        self.assertNotIn('body', payload['results'][1])

        second = self.client.get(payload['next'])
        self.assertEqual([item['slug'] for item in second.json()['results']], [older.slug])
        self.assertEqual(second.json()['previous'], '/api/v1/blog/posts/?page=1&page_size=2')
        self.assertNotIn(draft.slug, [item['slug'] for item in payload['results']])

    def test_empty_listing_has_a_stable_empty_response(self):
        response = self.client.get('/api/v1/blog/posts/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {
            'count': 0, 'next': None, 'previous': None, 'results': [],
        })

    def test_listing_rejects_bad_pagination_and_unknown_or_private_tags(self):
        for query in (
            'page=0', 'page=not-a-number', 'page_size=101', 'unknown=value',
        ):
            with self.subTest(query=query):
                response = self.client.get(f'/api/v1/blog/posts/?{query}')
                self.assertEqual(response.status_code, 400)

        self.post('draft-only', status=BlogPost.Status.DRAFT).tags.add(self.draft_tag)
        self.assertEqual(self.client.get('/api/v1/blog/posts/?tag=').status_code, 400)
        self.assertEqual(self.client.get('/api/v1/blog/posts/?tag=missing').status_code, 404)
        self.assertEqual(self.client.get('/api/v1/blog/posts/?tag=draft-topic').status_code, 404)
        self.assertEqual(self.client.get('/api/v1/blog/posts/?page=100').status_code, 404)

    def test_tag_filter_returns_only_matching_published_posts_and_preserves_pagination(self):
        now = timezone.now()
        first = self.post('ai-first', now - timedelta(seconds=2))
        first.tags.add(self.ai)
        second = self.post('ai-second', now - timedelta(seconds=1))
        second.tags.add(self.ai)
        self.post('unrelated', now)
        self.post('ai-draft', now + timedelta(seconds=1), status=BlogPost.Status.DRAFT).tags.add(self.ai)

        response = self.client.get('/api/v1/blog/posts/?tag=ai&page_size=1')
        payload = response.json()
        self.assertEqual(payload['count'], 2)
        self.assertEqual([item['slug'] for item in payload['results']], ['ai-second'])
        self.assertEqual(payload['next'], '/api/v1/blog/posts/?page=2&page_size=1&tag=ai')
        next_page = self.client.get(payload['next'])
        self.assertEqual([item['slug'] for item in next_page.json()['results']], ['ai-first'])
        self.assertEqual(next_page.json()['previous'], '/api/v1/blog/posts/?page=1&page_size=1&tag=ai')

    def test_detail_returns_published_markdown_author_and_tags(self):
        post = self.post('published-detail', body='## Markdown source')
        post.tags.add(self.ai)

        response = self.client.get('/api/v1/blog/posts/published-detail/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {
            'slug': post.slug,
            'title': post.title,
            'published_at': post.published_at.isoformat(),
            'author': {'username': 'owner', 'name': 'Site Owner'},
            'tags': [{'name': 'AI', 'slug': 'ai'}],
            'thumbnail': None,
            'hide_thumbnail_on_detail': False,
            'body': '## Markdown source',
        })

    def test_detail_hides_missing_and_draft_posts_with_the_same_404(self):
        self.post('hidden-draft', status=BlogPost.Status.DRAFT)

        draft = self.client.get('/api/v1/blog/posts/hidden-draft/')
        missing = self.client.get('/api/v1/blog/posts/not-found/')

        self.assertEqual(draft.status_code, 404)
        self.assertEqual(missing.status_code, 404)
        self.assertEqual(draft.json(), {'detail': 'Not found.'})
        self.assertEqual(missing.json(), draft.json())
        self.assertEqual(self.client.get('/api/v1/blog/posts/published-detail/?q=x').status_code, 400)

    def test_historical_urls_redirect_directly_to_latest_slug(self):
        post = self.post('first-url')
        post.slug = 'second-url'
        post.save()
        post.slug = 'latest-url'
        post.save()

        for historical_slug in ('first-url', 'second-url'):
            with self.subTest(historical_slug=historical_slug):
                response = self.client.get(f'/api/v1/blog/posts/{historical_slug}/')
                self.assertEqual(response.status_code, 301)
                self.assertEqual(response['Location'], '/api/v1/blog/posts/latest-url/')

        latest = self.client.get('/api/v1/blog/posts/latest-url/')
        self.assertEqual(latest.status_code, 200)
        self.assertEqual(latest.json()['slug'], 'latest-url')

    def test_tag_collection_excludes_tags_used_only_by_drafts(self):
        first = self.post('tagged-first')
        first.tags.add(self.ai)
        second = self.post('tagged-second')
        second.tags.add(self.ai, self.python)
        self.post('draft-topic-post', status=BlogPost.Status.DRAFT).tags.add(self.draft_tag)

        response = self.client.get('/api/v1/blog/tags/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {
            'count': 2,
            'results': [
                {'slug': 'ai', 'name': 'AI', 'post_count': 2},
                {'slug': 'python', 'name': 'Python', 'post_count': 1},
            ],
        })
        self.assertEqual(self.client.get('/api/v1/blog/tags/?page=1').status_code, 400)

    def test_public_blog_endpoints_allow_only_safe_methods_even_with_csrf_checks(self):
        self.post('example')
        paths = (
            '/api/v1/blog/posts/',
            '/api/v1/blog/posts/example/',
            '/api/v1/blog/tags/',
        )
        for path in paths:
            with self.subTest(path=path):
                head = self.client.head(path)
                self.assertEqual(head.status_code, 200)
                self.assertEqual(head.content, b'')
                for method in ('post', 'put', 'patch', 'delete'):
                    with self.subTest(method=method):
                        response = getattr(self.client, method)(path)
                        self.assertEqual(response.status_code, 405)
                        self.assertEqual(response.headers['Allow'], 'GET, HEAD')


class DraftPreviewApiTests(TestCase):
    def setUp(self):
        self.user_model = get_user_model()
        self.author = self.user_model.objects.create_user(username='owner')
        self.draft = BlogPost.objects.create(
            slug='private-draft', title='Private draft', author=self.author,
            body='# Draft source',
        )
        self.client = Client(HTTP_HOST='localhost')
        self.preview_url = '/api/v1/blog/posts/private-draft/preview/'

    def test_anonymous_user_cannot_preview_draft(self):
        response = self.client.get(self.preview_url)

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json(), {'detail': 'Authentication required.'})
        self.assertIn('no-store', response['Cache-Control'])

    def test_non_staff_user_cannot_preview_draft(self):
        user = self.user_model.objects.create_user(username='reader')
        self.client.force_login(user)

        response = self.client.get(self.preview_url)

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json(), {'detail': 'Permission denied.'})
        self.assertIn('no-store', response['Cache-Control'])

    def test_inactive_staff_user_cannot_preview_draft(self):
        user = self.user_model.objects.create_user(
            username='inactive-staff', is_staff=True, is_active=False,
        )
        self.client.force_login(user)

        response = self.client.get(self.preview_url)

        # Django does not restore an inactive user from the admin session.
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json(), {'detail': 'Authentication required.'})
        self.assertIn('no-store', response['Cache-Control'])

    def test_staff_without_post_view_permission_cannot_preview_draft(self):
        user = self.user_model.objects.create_user(username='limited-staff', is_staff=True)
        self.client.force_login(user)

        response = self.client.get(self.preview_url)

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json(), {'detail': 'Permission denied.'})
        self.assertIn('no-store', response['Cache-Control'])

    def test_active_staff_with_post_view_permission_can_preview_draft(self):
        user = self.user_model.objects.create_user(username='editor', is_staff=True)
        permission = Permission.objects.get(
            content_type__app_label='blog', codename='view_blogpost',
        )
        user.user_permissions.add(permission)
        self.client.force_login(user)

        response = self.client.get(self.preview_url)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {
            'slug': 'private-draft',
            'title': 'Private draft',
            'published_at': None,
            'author': {'username': 'owner', 'name': 'owner'},
            'tags': [],
            'thumbnail': None,
            'hide_thumbnail_on_detail': False,
            'body': '# Draft source',
        })
        self.assertIn('no-store', response['Cache-Control'])

    def test_public_blog_endpoints_do_not_expose_drafts_or_draft_only_tags(self):
        draft_only_tag = Tag.objects.create(name='Private topic', slug='private-topic')
        self.draft.tags.add(draft_only_tag)

        listing = self.client.get('/api/v1/blog/posts/')
        detail = self.client.get('/api/v1/blog/posts/private-draft/')
        tags = self.client.get('/api/v1/blog/tags/')

        self.assertEqual(listing.status_code, 200)
        self.assertEqual(listing.json()['results'], [])
        self.assertEqual(detail.status_code, 404)
        self.assertEqual(detail.json(), {'detail': 'Not found.'})
        self.assertEqual(tags.status_code, 200)
        self.assertEqual(tags.json(), {'count': 0, 'results': []})
