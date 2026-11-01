#!/usr/bin/env python3
"""Create consistent website backups and restore them into a fresh Compose project."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_COMPOSE_FILE = ROOT / "compose.production.yaml"
DEFAULT_ENV_FILE = ROOT / "production.env"
MANIFEST_NAME = "manifest.json"
DATABASE_NAME = "database.dump"
MEDIA_NAME = "media.tar.gz"
MEDIA_ARCHIVE_SCRIPT = (
    "import os,sys,tarfile; "
    "root=os.environ.get('DJANGO_MEDIA_ROOT','/data/media'); "
    "archive=tarfile.open(fileobj=sys.stdout.buffer,mode='w|gz'); "
    "archive.add(root,arcname='.'); archive.close()"
)
MEDIA_RESTORE_SCRIPT = (
    "import os,sys,tarfile; "
    "root=os.environ.get('DJANGO_MEDIA_ROOT','/data/media'); "
    "os.makedirs(root,exist_ok=True); "
    "archive=tarfile.open(fileobj=sys.stdin.buffer,mode='r|gz'); "
    "archive.extractall(path=root,filter='data'); archive.close()"
)
DATABASE_DUMP_COMMAND = (
    'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump --no-password --format=custom '
    '--username="$POSTGRES_USER" --host=127.0.0.1 --dbname="$POSTGRES_DB"'
)
DATABASE_RESTORE_COMMAND = (
    'PGPASSWORD="$POSTGRES_PASSWORD" pg_restore --exit-on-error --no-owner '
    '--no-privileges --username="$POSTGRES_USER" --host=127.0.0.1 '
    '--dbname="$POSTGRES_DB" /tmp/ticket57-database.dump'
)
PROJECT_NAME_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{0,62}$")


class BackupError(RuntimeError):
    """An expected command or archive validation failed."""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)

    backup = commands.add_parser("backup", help="write a consistent database and media backup")
    _add_compose_options(backup)
    backup.add_argument("--project-name", required=True, help="running Compose project name")
    backup.add_argument("--output", required=True, type=Path, help="new backup directory path")

    restore = commands.add_parser("restore", help="restore into a new isolated Compose project")
    _add_compose_options(restore)
    restore.set_defaults(compose_file=ROOT / "compose.yaml")
    restore.add_argument("--project-name", required=True, help="new name beginning with restore-")
    restore.add_argument("--backup", required=True, type=Path, help="backup directory to restore")
    return parser.parse_args()


def _add_compose_options(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--compose-file", type=Path, default=DEFAULT_COMPOSE_FILE)
    parser.add_argument("--env-file", type=Path, default=DEFAULT_ENV_FILE)


class Compose:
    def __init__(self, project: str, compose_file: Path, env_file: Path):
        self.project = project
        self.compose_file = compose_file.resolve()
        self.env_file = env_file.resolve()
        if not self.compose_file.is_file():
            raise BackupError(f"Compose file does not exist: {self.compose_file}")
        if not self.env_file.is_file():
            raise BackupError(
                f"Environment file does not exist: {self.env_file}. "
                "Create a protected file from the relevant example first."
            )
        self.base = [
            "docker",
            "compose",
            "--project-name",
            project,
            "--file",
            str(self.compose_file),
            "--env-file",
            str(self.env_file),
        ]

    def command(self, *args: str) -> list[str]:
        return [*self.base, *args]

    def run(self, *args: str) -> subprocess.CompletedProcess[bytes]:
        cmd = self.command(*args)
        try:
            result = subprocess.run(
                cmd,
                cwd=ROOT,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=False,
            )
        except OSError as error:
            raise BackupError(f"Could not run {format_command(cmd)}: {error}") from error
        if result.returncode:
            detail = result.stderr.decode(errors="replace").strip()
            if not detail:
                detail = result.stdout.decode(errors="replace").strip()
            raise BackupError(f"Command failed ({result.returncode}): {format_command(cmd)}\n{detail}")
        return result

    def write_stdout(self, destination: Path, *args: str) -> None:
        cmd = self.command(*args)
        try:
            with destination.open("wb") as output:
                result = subprocess.run(
                    cmd,
                    cwd=ROOT,
                    stdout=output,
                    stderr=subprocess.PIPE,
                    check=False,
                )
        except OSError as error:
            raise BackupError(f"Could not write {destination}: {error}") from error
        if result.returncode:
            detail = result.stderr.decode(errors="replace").strip()
            raise BackupError(f"Command failed ({result.returncode}): {format_command(cmd)}\n{detail}")

    def stream_stdin(self, source: Path, *args: str) -> None:
        cmd = self.command(*args)
        try:
            with source.open("rb") as input_file:
                process = subprocess.Popen(
                    cmd,
                    cwd=ROOT,
                    stdin=subprocess.PIPE,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                )
                assert process.stdin is not None
                try:
                    shutil.copyfileobj(input_file, process.stdin, length=1024 * 1024)
                except BrokenPipeError:
                    pass
                finally:
                    process.stdin.close()
                    process.stdin = None
                stdout, stderr = process.communicate()
        except OSError as error:
            raise BackupError(f"Could not stream {source} to Compose: {error}") from error
        if process.returncode:
            detail = stderr.decode(errors="replace").strip() or stdout.decode(errors="replace").strip()
            raise BackupError(f"Command failed ({process.returncode}): {format_command(cmd)}\n{detail}")

    def copy_to(self, source: Path, target: str) -> None:
        self.run("cp", str(source), target)


def format_command(command: list[str]) -> str:
    # Environment files contain credentials, so only their path is shown by Compose.
    return " ".join(command)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def parse_compose_json(data: str) -> list[dict[str, object]]:
    data = data.strip()
    if not data:
        return []
    try:
        parsed = json.loads(data)
        if isinstance(parsed, list):
            return [item for item in parsed if isinstance(item, dict)]
        if isinstance(parsed, dict):
            return [parsed]
    except json.JSONDecodeError:
        rows = []
        for line in data.splitlines():
            try:
                item = json.loads(line)
            except json.JSONDecodeError as error:
                raise BackupError("Could not parse `docker compose ps --format json` output") from error
            if isinstance(item, dict):
                rows.append(item)
        return rows
    raise BackupError("Unexpected `docker compose ps --format json` output")


def running_services(compose: Compose) -> set[str]:
    rows = parse_compose_json(compose.run("ps", "--all", "--format", "json").stdout.decode())
    return {
        str(row.get("Service", row.get("service", "")))
        for row in rows
        if str(row.get("State", row.get("state", ""))).lower() == "running"
    }


def write_backup(compose: Compose, output: Path) -> Path:
    output = output.resolve()
    if output.exists():
        raise BackupError(f"Backup destination already exists: {output}")
    if not output.parent.is_dir():
        raise BackupError(f"Backup parent directory does not exist: {output.parent}")
    if "db" not in running_services(compose):
        raise BackupError("The Compose database service must be running before backup")

    was_backend_running = "backend" in running_services(compose)
    temporary = Path(tempfile.mkdtemp(prefix=f".{output.name}.partial-", dir=output.parent))
    if os.name != "nt":
        temporary.chmod(0o700)
    stopped = False
    try:
        if was_backend_running:
            stopped = True
            compose.run("stop", "--timeout", "60", "backend")

        compose.write_stdout(
            temporary / DATABASE_NAME,
            "exec",
            "-T",
            "db",
            "sh",
            "-ec",
            DATABASE_DUMP_COMMAND,
        )
        compose.write_stdout(
            temporary / MEDIA_NAME,
            "run",
            "--rm",
            "--no-deps",
            "-T",
            "--entrypoint",
            "python",
            "backend",
            "-c",
            MEDIA_ARCHIVE_SCRIPT,
        )
        manifest = {
            "format_version": 1,
            "created_at_utc": datetime.now(timezone.utc).isoformat(),
            "project_name": compose.project,
            "compose_file": compose.compose_file.name,
            "database_dump": DATABASE_NAME,
            "media_archive": MEDIA_NAME,
            "sha256": {
                DATABASE_NAME: sha256_file(temporary / DATABASE_NAME),
                MEDIA_NAME: sha256_file(temporary / MEDIA_NAME),
            },
        }
        manifest_path = temporary / MANIFEST_NAME
        manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
        if os.name != "nt":
            for item in temporary.iterdir():
                item.chmod(0o600)
        temporary.rename(output)
        return output
    except BaseException:
        shutil.rmtree(temporary, ignore_errors=True)
        raise
    finally:
        if stopped:
            compose.run("up", "--detach", "--wait", "--wait-timeout", "120", "backend")


def validate_project_name(project: str) -> None:
    if not PROJECT_NAME_RE.fullmatch(project):
        raise BackupError("Project name must use lowercase letters, digits, hyphens, or underscores")
    if not project.startswith("restore-"):
        raise BackupError("Restore project name must begin with 'restore-' to protect the source stack")


def validate_manifest(backup: Path) -> dict[str, object]:
    if not backup.is_dir():
        raise BackupError(f"Backup directory does not exist: {backup}")
    manifest_path = backup / MANIFEST_NAME
    if manifest_path.is_symlink():
        raise BackupError("Backup manifest must not be a symbolic link")
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise BackupError(f"Could not read backup manifest: {error}") from error
    if not isinstance(manifest, dict) or manifest.get("format_version") != 1:
        raise BackupError("Unsupported or malformed backup manifest")
    hashes = manifest.get("sha256")
    if not isinstance(hashes, dict):
        raise BackupError("Backup manifest is missing file checksums")
    for name in (DATABASE_NAME, MEDIA_NAME):
        path = backup / name
        expected = hashes.get(name)
        if not isinstance(expected, str) or path.is_symlink() or not path.is_file():
            raise BackupError(f"Backup is missing {name} or its checksum")
        if sha256_file(path) != expected:
            raise BackupError(f"Checksum mismatch for {name}; refusing to restore")
    validate_media_archive(backup / MEDIA_NAME)
    return manifest


def validate_media_archive(path: Path) -> None:
    try:
        with tarfile.open(path, mode="r:gz") as archive:
            for member in archive:
                entry = PurePosixPath(member.name)
                if entry.is_absolute() or ".." in entry.parts:
                    raise BackupError(f"Unsafe media archive path: {member.name}")
                if not (member.isfile() or member.isdir()):
                    raise BackupError(f"Unsupported media archive entry type: {member.name}")
    except (tarfile.TarError, OSError) as error:
        raise BackupError(f"Invalid media archive: {error}") from error


def ensure_fresh_restore_project(compose: Compose) -> None:
    containers = compose.run("ps", "--all", "--quiet").stdout.decode().strip()
    try:
        volumes = subprocess.run(
            [
                "docker",
                "volume",
                "ls",
                "--quiet",
                "--filter",
                f"label=com.docker.compose.project={compose.project}",
            ],
            cwd=ROOT,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False,
        )
    except OSError as error:
        raise BackupError(f"Could not inspect Docker volumes: {error}") from error
    if volumes.returncode:
        raise BackupError(volumes.stderr.decode(errors="replace").strip())
    networks = subprocess.run(
        [
            "docker",
            "network",
            "ls",
            "--quiet",
            "--filter",
            f"label=com.docker.compose.project={compose.project}",
        ],
        cwd=ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if networks.returncode:
        raise BackupError(networks.stderr.decode(errors="replace").strip())
    if containers or volumes.stdout.decode().strip() or networks.stdout.decode().strip():
        raise BackupError(
            f"Compose project {compose.project!r} already has containers, volumes, or networks; "
            "choose a new restore-* name to avoid overwriting data"
        )


def restore_backup(compose: Compose, backup: Path) -> None:
    if compose.compose_file != (ROOT / "compose.yaml").resolve():
        raise BackupError(
            "Restore is restricted to the repository's local compose.yaml so the restored "
            "stack stays loopback-only and can use a separate proxy port"
        )
    backup = backup.resolve()
    validate_manifest(backup)
    ensure_fresh_restore_project(compose)

    # Create only the empty DB first. Backend migrations run after both snapshots are restored.
    compose.run("up", "--detach", "--wait", "--wait-timeout", "120", "db")
    database_archive = "/tmp/ticket57-database.dump"
    compose.copy_to(backup / DATABASE_NAME, f"db:{database_archive}")
    try:
        compose.run("exec", "-T", "db", "sh", "-ec", DATABASE_RESTORE_COMMAND)
    finally:
        compose.run("exec", "-T", "db", "rm", "-f", database_archive)
    compose.stream_stdin(
        backup / MEDIA_NAME,
        "run",
        "--rm",
        "--no-deps",
        "-T",
        "--interactive",
        "--entrypoint",
        "python",
        "backend",
        "-c",
        MEDIA_RESTORE_SCRIPT,
    )
    compose.run(
        "up",
        "--build",
        "--detach",
        "--wait",
        "--wait-timeout",
        "240",
    )


def main() -> int:
    args = parse_args()
    try:
        if args.command == "restore":
            validate_project_name(args.project_name)
        compose = Compose(args.project_name, args.compose_file, args.env_file)
        if args.command == "backup":
            result = write_backup(compose, args.output)
            print(f"Backup complete: {result}")
        else:
            restore_backup(compose, args.backup)
            print(f"Restore complete in isolated Compose project {args.project_name!r}.")
            print(
                "The restored stack is left running for verification. "
                f"Remove it with: {' '.join(compose.command('down', '--volumes'))}"
            )
    except BackupError as error:
        print(f"backup_restore: error: {error}", file=sys.stderr)
        return 1
    except OSError as error:
        print(f"backup_restore: error: {error}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("backup_restore: interrupted", file=sys.stderr)
        return 130
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
