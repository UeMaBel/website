import hashlib
import io
import json
import re
import tarfile
import tempfile
import unittest
from pathlib import Path

from backup_restore import (
    BackupError,
    parse_compose_json,
    validate_manifest,
    validate_media_archive,
    validate_project_name,
)


class BackupRestoreValidationTests(unittest.TestCase):
    def test_restore_documentation_uses_one_proxy_port(self):
        documentation = (Path(__file__).resolve().parents[1] / "docs" / "backup-restore.md").read_text()
        config = re.search(
            r"PROXY_PORT=(\d+).*?PUBLIC_SITE_ORIGIN=http://localhost:(\d+)",
            documentation,
            re.DOTALL,
        )
        health_check = re.search(r"curl -fsS http://localhost:(\d+)/api/v1/health/", documentation)
        self.assertIsNotNone(config)
        self.assertIsNotNone(health_check)
        self.assertEqual(config.group(1), config.group(2))
        self.assertEqual(config.group(1), health_check.group(1))

    def test_restore_requires_an_isolated_project_name(self):
        validate_project_name("restore-drill-57")
        for name in ("personal-website-production", "Restore-test", "restore bad"):
            with self.subTest(name=name), self.assertRaises(BackupError):
                validate_project_name(name)

    def test_compose_status_accepts_array_and_line_json(self):
        item = {"Service": "backend", "State": "running"}
        self.assertEqual(parse_compose_json(json.dumps([item])), [item])
        self.assertEqual(parse_compose_json(json.dumps(item) + "\n" + json.dumps(item)), [item, item])

    def test_manifest_checksums_are_verified(self):
        with tempfile.TemporaryDirectory() as directory:
            backup = Path(directory)
            database = b"database snapshot"
            (backup / "database.dump").write_bytes(database)
            with tarfile.open(backup / "media.tar.gz", "w:gz") as archive:
                content = b"image"
                info = tarfile.TarInfo("./uploads/image.png")
                info.size = len(content)
                archive.addfile(info, io.BytesIO(content))
            manifest = {
                "format_version": 1,
                "sha256": {
                    "database.dump": hashlib.sha256(database).hexdigest(),
                    "media.tar.gz": hashlib.sha256((backup / "media.tar.gz").read_bytes()).hexdigest(),
                },
            }
            (backup / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
            validate_manifest(backup)

            (backup / "database.dump").write_bytes(b"changed")
            with self.assertRaisesRegex(BackupError, "Checksum mismatch"):
                validate_manifest(backup)

    def test_media_archive_rejects_paths_outside_media_root(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "media.tar.gz"
            with tarfile.open(path, "w:gz") as archive:
                info = tarfile.TarInfo("../../outside.txt")
                info.size = 0
                archive.addfile(info, io.BytesIO())
            with self.assertRaisesRegex(BackupError, "Unsafe media archive path"):
                validate_media_archive(path)


if __name__ == "__main__":
    unittest.main()
