from django.test import Client, TestCase


class HealthTests(TestCase):
    def test_public_health_returns_only_liveness_without_database_queries(self):
        with self.assertNumQueries(0):
            response = self.client.get('/api/v1/health/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers['Content-Type'], 'application/json')
        self.assertEqual(response.json(), {'status': 'ok'})

    def test_head_has_no_body(self):
        response = self.client.head('/api/v1/health/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, b'')

    def test_unsafe_methods_are_rejected_even_without_csrf_token(self):
        client = Client(enforce_csrf_checks=True)
        for method in ('post', 'put', 'patch', 'delete'):
            with self.subTest(method=method):
                response = getattr(client, method)('/api/v1/health/')
                self.assertEqual(response.status_code, 405)
                self.assertEqual(response.headers['Allow'], 'GET, HEAD')
                self.assertEqual(response.content, b'')
