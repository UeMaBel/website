"""Tests for offsite backup configuration and command orchestration."""

from __future__ import annotations

import contextlib
import io
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import offsite_backup


class OffsiteBackupTests(unittest.TestCase):
    def test_missing_password_file_fails_before_starting_compose(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            env = {
                "BACKUP_PROJECT_NAME": "drill",
                "BACKUP_COMPOSE_FILE": "compose.yaml",
                "BACKUP_ENV_FILE": "backend/.env",
                "RESTIC_REPOSITORY": str(Path(temporary) / "repository"),
                "RESTIC_PASSWORD_FILE": str(Path(temporary) / "missing-password"),
            }
            stderr = io.StringIO()
            with patch.dict(os.environ, env, clear=True), patch.object(
                offsite_backup, "run"
            ) as run, contextlib.redirect_stderr(stderr):
                result = offsite_backup.main()

        self.assertEqual(result, 1)
        run.assert_not_called()
        self.assertIn("Restic password file does not exist", stderr.getvalue())

    def test_backup_uses_sftp_args_stable_source_and_retention(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            password_file = root / "password"
            password_file.write_text("test-only-password", encoding="utf-8")
            staging_root = root / "staging"
            commands: list[list[str]] = []
            env = {
                "BACKUP_PROJECT_NAME": "drill",
                "BACKUP_COMPOSE_FILE": "compose.yaml",
                "BACKUP_ENV_FILE": "backend/.env",
                "BACKUP_STAGING_ROOT": str(staging_root),
                "BACKUP_RETENTION_DAYS": "30",
                "RESTIC_REPOSITORY": str(root / "repository"),
                "RESTIC_PASSWORD_FILE": str(password_file),
                "RESTIC_BIN": "restic-test",
                "RESTIC_SFTP_ARGS": "-i /tmp/test-key -o StrictHostKeyChecking=yes",
            }
            stderr = io.StringIO()
            with patch.dict(os.environ, env, clear=True), patch.object(
                offsite_backup, "run", side_effect=lambda command, *, env: commands.append(command)
            ), contextlib.redirect_stderr(stderr):
                result = offsite_backup.main()

            self.assertEqual(result, 0, stderr.getvalue())
            restic_commands = commands[1:]
            self.assertEqual(len(restic_commands), 2)
            for command in restic_commands:
                self.assertEqual(command[:3], ["restic-test", "-o", "sftp.args=-i /tmp/test-key -o StrictHostKeyChecking=yes"])
            self.assertEqual(restic_commands[0][3:7], ["backup", "--host", "personal-website", "--tag"])
            self.assertIn(str(staging_root.resolve() / "current" / "website"), restic_commands[0])
            self.assertIn("--keep-within-daily", restic_commands[1])
            self.assertIn("30d", restic_commands[1])
            self.assertFalse((staging_root / ".offsite-backup.lock").exists())
            self.assertFalse((staging_root / "current").exists())


if __name__ == "__main__":
    unittest.main()
