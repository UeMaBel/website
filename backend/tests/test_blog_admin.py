from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.test import Client, TestCase
from django.utils import timezone

from blog.models import BlogPost


class BlogPostAdminPreviewTests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.author = user_model.objects.create_user(username='owner')
        self.staff = user_model.objects.create_user(username='editor', is_staff=True)
        self.staff.user_permissions.add(*Permission.objects.filter(
            content_type__app_label='blog',
            codename__in=('view_blogpost', 'change_blogpost'),
        ))
        self.post = BlogPost.objects.create(
            slug='draft-post', title='Draft post', author=self.author, body='# Draft',
        )
        self.client = Client(HTTP_HOST='localhost')
        self.client.force_login(self.staff)
        self.change_url = f'/admin/blog/blogpost/{self.post.pk}/change/'

    def test_draft_admin_screen_links_to_same_origin_preview_and_saves_content(self):
        page = self.client.get(self.change_url)

        self.assertEqual(page.status_code, 200)
        self.assertContains(page, 'href="/blog/draft-post/preview"')
        self.assertNotContains(page, 'token=')
        self.assertNotContains(page, 'https://')

        response = self.client.post(self.change_url, {
            'title': 'Saved draft title',
            'slug': 'draft-post',
            'author': str(self.author.pk),
            'body': '# Saved draft body',
            'tags': [],
            'status': BlogPost.Status.DRAFT,
            'published_at': '',
            '_save': 'Save',
        })

        self.assertEqual(response.status_code, 302)
        self.post.refresh_from_db()
        self.assertEqual(self.post.title, 'Saved draft title')
        self.assertEqual(self.post.body, '# Saved draft body')

        preview = self.client.get('/api/v1/blog/posts/draft-post/preview/')
        self.assertEqual(preview.status_code, 200)
        self.assertEqual(preview.json()['body'], '# Saved draft body')

    def test_published_post_does_not_offer_draft_preview(self):
        self.post.status = BlogPost.Status.PUBLISHED
        self.post.published_at = timezone.now()
        self.post.save()

        page = self.client.get(self.change_url)

        self.assertEqual(page.status_code, 200)
        self.assertNotContains(page, '/blog/draft-post/preview')
