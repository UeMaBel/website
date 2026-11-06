import json
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import Client, TestCase, override_settings
from django.utils import timezone

from blog.models import BlogPost
from site_statistics.models import DailyPageTotal


@override_settings(STATISTICS_ENABLED=True)
class AggregateStatisticsTests(TestCase):
    def setUp(self):
        self.client = Client(enforce_csrf_checks=True)
        self.view = {'path': '/', 'referrer': 'github', 'views': 1, 'seconds': 0}

    def send(self, data, **headers):
        return self.client.post('/api/v1/statistics/', json.dumps(data), content_type='application/json', **headers)

    def test_merges_contributions_without_event_or_visitor_records(self):
        for _ in range(2):
            response = self.send(self.view, REMOTE_ADDR='192.0.2.123', HTTP_USER_AGENT='Private browser', HTTP_COOKIE='sessionid=private')
            self.assertEqual(response.status_code, 204)
            self.assertFalse(response.cookies)
        self.send({**self.view, 'views': 0, 'seconds': 15})
        row = DailyPageTotal.objects.get()
        self.assertEqual((row.views, row.seconds), (2, 15))
        self.assertEqual({f.name for f in DailyPageTotal._meta.fields}, {'id', 'day', 'path', 'referrer', 'views', 'seconds'})

    def test_rejects_identity_fields_raw_referrers_and_invalid_counters(self):
        for extra in ({'ip': '192.0.2.1'}, {'user_id': 'person'}, {'session': 'id'}, {'timestamp': 'now'}):
            self.assertEqual(self.send({**self.view, **extra}).status_code, 400)
        for changes in (
            {'referrer': 'https://person.private.test'}, {'seconds': 5}, {'views': True},
            {'views': 0, 'seconds': 31}, {'views': 0, 'seconds': -5}, {'views': 0, 'seconds': 0},
            {'views': 0, 'seconds': 4.5}, {'views': 0, 'seconds': True}, {'referrer': []},
        ):
            self.assertEqual(self.send({**self.view, **changes}).status_code, 400)
        self.assertFalse(DailyPageTotal.objects.exists())

    def test_only_existing_public_pages_are_accepted(self):
        author = get_user_model().objects.create_user(username='author')
        published = BlogPost.objects.create(title='Public', slug='public', author=author, body='Text', status='published', published_at=timezone.now())
        BlogPost.objects.create(title='Draft', slug='draft', author=author, body='Text')
        for path in ['/blog/draft', '/blog/missing', '/blog/public/preview', '/admin', '/?email=private', '/contact#secret']:
            self.assertEqual(self.send({**self.view, 'path': path}).status_code, 400)
        self.assertEqual(self.send({**self.view, 'path': f'/blog/{published.slug}'}).status_code, 204)

    def test_methods_body_limits_and_invalid_json_do_not_store_data(self):
        self.assertEqual(self.client.get('/api/v1/statistics/').status_code, 405)
        self.assertEqual(self.client.post('/api/v1/statistics/', '{}', content_type='text/plain').status_code, 415)
        self.assertEqual(self.client.post('/api/v1/statistics/', '{', content_type='application/json').status_code, 400)
        self.assertEqual(self.send({'long': 'x' * 1025}).status_code, 413)
        self.assertEqual(self.send([]).status_code, 400)
        self.assertFalse(DailyPageTotal.objects.exists())

    @override_settings(STATISTICS_ENABLED=False)
    def test_disabled_collection_has_no_database_or_cookie_side_effects(self):
        with self.assertNumQueries(0):
            response = self.send(self.view)
        self.assertEqual(response.status_code, 204)
        self.assertFalse(response.cookies)

    def test_collection_and_management_command_enforce_ninety_day_retention(self):
        today = timezone.now().date()
        recent = DailyPageTotal.objects.create(day=today - timedelta(days=89), path='/', referrer='direct')
        old = DailyPageTotal.objects.create(day=today - timedelta(days=90), path='/', referrer='direct')
        self.send(self.view)
        self.assertTrue(DailyPageTotal.objects.filter(pk=recent.pk).exists())
        self.assertFalse(DailyPageTotal.objects.filter(pk=old.pk).exists())
        old = DailyPageTotal.objects.create(day=today - timedelta(days=90), path='/', referrer='direct')
        call_command('purge_statistics', verbosity=0)
        self.assertFalse(DailyPageTotal.objects.filter(pk=old.pk).exists())
