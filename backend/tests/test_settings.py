import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest


class EnvironmentSettingsTests(unittest.TestCase):
    def settings(self, env_file=None, **overrides):
        env = {key: value for key, value in os.environ.items()
               if not key.startswith(("DJANGO_", "POSTGRES_"))}
        env.update(overrides)
        # Copy the real settings so tests never read the developer's .env.
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            (base / "config").mkdir()
            settings_path = base / "config" / "settings.py"
            shutil.copyfile(Path(__file__).resolve().parents[1] / "config" / "settings.py",
                            settings_path)
            if env_file is not None:
                (base / ".env").write_text(env_file, encoding="utf-8")
            return subprocess.run(
                [sys.executable, "-c", "import json, runpy, sys, types; "
                 "settings = types.SimpleNamespace(**runpy.run_path(sys.argv[1])); "
                 "print(json.dumps({'secret': settings.SECRET_KEY, 'debug': settings.DEBUG, "
                 "'hosts': settings.ALLOWED_HOSTS, 'database': settings.DATABASES['default']}, default=str))",
                 str(settings_path)],
                env=env, capture_output=True, text=True,
            )

    def test_dotenv_loads_from_backend_directory(self):
        result = self.settings(env_file="DJANGO_SECRET_KEY=file-secret\nDJANGO_DEBUG=true\n")
        self.assertEqual(result.returncode, 0, result.stderr)
        actual = json.loads(result.stdout)
        self.assertEqual(actual["secret"], "file-secret")
        self.assertTrue(actual["debug"])

    def test_environment_takes_precedence_over_dotenv(self):
        result = self.settings(env_file="DJANGO_SECRET_KEY=file-secret\nDJANGO_DEBUG=true\n",
                               DJANGO_SECRET_KEY="environment-secret", DJANGO_DEBUG="false")
        self.assertEqual(result.returncode, 0, result.stderr)
        actual = json.loads(result.stdout)
        self.assertEqual(actual["secret"], "environment-secret")
        self.assertFalse(actual["debug"])

    def test_empty_secret_in_dotenv_fails(self):
        result = self.settings(env_file="DJANGO_SECRET_KEY=\n")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("DJANGO_SECRET_KEY must be set", result.stderr)

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
