import json
import os
import subprocess
import sys
import unittest


class EnvironmentSettingsTests(unittest.TestCase):
    def settings(self, **overrides):
        env = {key: value for key, value in os.environ.items()
               if not key.startswith(("DJANGO_", "POSTGRES_"))}
        env.update(overrides)
        return subprocess.run(
            [sys.executable, "-c", "import json; from config import settings; "
             "print(json.dumps({'secret': settings.SECRET_KEY, 'debug': settings.DEBUG, "
             "'hosts': settings.ALLOWED_HOSTS, 'database': settings.DATABASES['default']}, default=str))"],
            env=env, capture_output=True, text=True,
        )

    def test_missing_secret_fails_with_actionable_error(self):
        result = self.settings()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("DJANGO_SECRET_KEY must be set", result.stderr)

    def test_environment_configures_postgres_and_secure_defaults(self):
        result = self.settings(DJANGO_SECRET_KEY="test-only-secret", POSTGRES_DB="content",
                               POSTGRES_USER="author", POSTGRES_PASSWORD="test-only-password",
                               POSTGRES_HOST="db", POSTGRES_PORT="5433",
                               DJANGO_ALLOWED_HOSTS="example.test, www.example.test")
        self.assertEqual(result.returncode, 0, result.stderr)
        actual = json.loads(result.stdout)
        self.assertEqual(actual["secret"], "test-only-secret")
        self.assertFalse(actual["debug"])
        self.assertEqual(actual["hosts"], ["example.test", "www.example.test"])
        self.assertEqual(actual["database"], {
            "ENGINE": "django.db.backends.postgresql", "NAME": "content", "USER": "author",
            "PASSWORD": "test-only-password", "HOST": "db", "PORT": "5433",
        })

    def test_debug_requires_explicit_true(self):
        result = self.settings(DJANGO_SECRET_KEY="test-only-secret", DJANGO_DEBUG="true")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(json.loads(result.stdout)["debug"])
