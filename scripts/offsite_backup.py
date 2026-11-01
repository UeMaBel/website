#!/usr/bin/env python3
"""Create a consistent ticket57 backup, encrypt it with restic, and prune old snapshots."""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKUP_SCRIPT = ROOT / "scripts" / "backup_restore.py"
REQUIRED = ("BACKUP_PROJECT_NAME", "BACKUP_COMPOSE_FILE", "BACKUP_ENV_FILE")
TAG = "personal-website"


class OffsiteBackupError(RuntimeError):
    pass


def required(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise OffsiteBackupError(f"Required setting {name} is missing")
    return value


def run(command: list[str], *, env: dict[str, str]) -> None:
    try:
        result = subprocess.run(
            command,
            cwd=ROOT,
            env=env,
            text=True,
            capture_output=True,
            check=False,
        )
    except OSError as error:
        raise OffsiteBackupError(f"Could not run {command[0]}: {error}") from error
    if result.returncode:
        details = result.stderr.strip() or result.stdout.strip()
        raise OffsiteBackupError(
            f"Command failed ({result.returncode}): {' '.join(command)}"
            + (f"\n{details}" if details else "")
        )
    if result.stdout.strip():
        print(result.stdout.strip())


def main() -> int:
    try:
        for name in REQUIRED:
            required(name)
        repository = required("RESTIC_REPOSITORY")
        password_file = Path(required("RESTIC_PASSWORD_FILE")).resolve()
        if not password_file.is_file():
            raise OffsiteBackupError(f"Restic password file does not exist: {password_file}")
        retention_days = int(os.environ.get("BACKUP_RETENTION_DAYS", "90"))
        if retention_days < 1:
            raise OffsiteBackupError("BACKUP_RETENTION_DAYS must be a positive integer")
        staging_root = Path(
            os.environ.get("BACKUP_STAGING_ROOT", "/var/lib/personal-website-backup")
        )
        staging_root.mkdir(mode=0o700, parents=True, exist_ok=True)
        staging_root = staging_root.resolve()
        if os.name != "nt":
            staging_root.chmod(0o700)
        lock = staging_root / ".offsite-backup.lock"
        try:
            descriptor = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        except FileExistsError as error:
            raise OffsiteBackupError(
                f"Another backup may be running (lock exists at {lock}); inspect and remove a stale lock"
            ) from error
        os.close(descriptor)

        run_root = staging_root / "current"
        backup_dir = run_root / "website"
        restic = os.environ.get("RESTIC_BIN", "restic")
        restic_command = [restic]
        if os.environ.get("RESTIC_SFTP_ARGS"):
            restic_command.extend(["-o", f"sftp.args={os.environ['RESTIC_SFTP_ARGS']}"])
        env = os.environ.copy()
        env["RESTIC_REPOSITORY"] = repository
        env["RESTIC_PASSWORD_FILE"] = str(password_file)
        if os.environ.get("RESTIC_CACHE_DIR"):
            env["RESTIC_CACHE_DIR"] = os.environ["RESTIC_CACHE_DIR"]
        try:
            if run_root.is_symlink():
                raise OffsiteBackupError(f"Staging directory must not be a symbolic link: {run_root}")
            shutil.rmtree(run_root, ignore_errors=True)
            run_root.mkdir(mode=0o700)
            if os.name != "nt":
                run_root.chmod(0o700)
            run(
                [
                    sys.executable,
                    str(BACKUP_SCRIPT),
                    "backup",
                    "--compose-file",
                    required("BACKUP_COMPOSE_FILE"),
                    "--env-file",
                    required("BACKUP_ENV_FILE"),
                    "--project-name",
                    required("BACKUP_PROJECT_NAME"),
                    "--output",
                    str(backup_dir),
                ],
                env=env,
            )
            run(
                [
                    *restic_command,
                    "backup",
                    "--host",
                    "personal-website",
                    "--tag",
                    TAG,
                    str(backup_dir),
                ],
                env=env,
            )
            run(
                [
                    *restic_command,
                    "forget",
                    "--tag",
                    TAG,
                    "--keep-within-daily",
                    f"{retention_days}d",
                    "--prune",
                ],
                env=env,
            )
            print(f"Encrypted offsite backup and {retention_days}-day retention completed.")
            return 0
        finally:
            shutil.rmtree(run_root, ignore_errors=True)
            lock.unlink(missing_ok=True)
    except (OffsiteBackupError, OSError, ValueError) as error:
        print(f"offsite_backup: error: {error}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("offsite_backup: interrupted", file=sys.stderr)
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
