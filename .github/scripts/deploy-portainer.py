"""Update an existing Portainer-managed Docker Standalone stack without SSH."""

import json
import os
from pathlib import Path
import re
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, urlopen


def deploy():
    base = os.environ["PORTAINER_URL"].rstrip("/")
    parsed = urlsplit(base)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.query or parsed.fragment:
        raise ValueError("PORTAINER_URL must be an HTTPS URL without credentials, query or fragment")
    stack_id = os.environ["PORTAINER_STACK_ID"]
    endpoint_id = os.environ["PORTAINER_ENDPOINT_ID"]
    if not stack_id.isdecimal() or not endpoint_id.isdecimal():
        raise ValueError("Portainer stack and endpoint IDs must be numeric")
    key = os.environ["PORTAINER_API_KEY"]
    if not key:
        raise ValueError("PORTAINER_API_KEY is required")
    images = {name: os.environ[name] for name in ("BACKEND_IMAGE", "FRONTEND_IMAGE")}
    for image in images.values():
        if not re.fullmatch(r"ghcr\.io/[a-z0-9_./-]+@sha256:[a-f0-9]{64}", image):
            raise ValueError("Application images must be GHCR SHA256 digest references")

    def api(path, method="GET", payload=None):
        request = Request(
            base + "/api" + path,
            data=None if payload is None else json.dumps(payload).encode(),
            headers={"X-API-Key": key, "Content-Type": "application/json"},
            method=method,
        )
        # Never print response bodies: stack responses can contain environment secrets.
        try:
            with urlopen(request, timeout=600 if method == "PUT" else 30) as response:
                return json.load(response)
        except HTTPError as error:
            raise RuntimeError(f"Portainer {method} failed with HTTP {error.code}") from None
        except (URLError, TimeoutError):
            raise RuntimeError(f"Portainer {method} connection failed; inspect stack state before retrying") from None

    stack = api(f"/stacks/{stack_id}")
    if stack["Type"] != 2 or str(stack["EndpointId"]) != endpoint_id or stack.get("GitConfig"):
        raise ValueError("Select a file/web-editor Docker Standalone stack on the configured endpoint")
    if stack["Name"] != "personal-website-production":
        raise ValueError("Stack must be named personal-website-production to match persistent resource names")
    # Keep database credentials and every other operator-managed value in Portainer.
    environment = [entry for entry in stack.get("Env", []) if entry["name"] not in images]
    environment.extend({"name": name, "value": value} for name, value in images.items())
    api(
        f"/stacks/{stack_id}?endpointId={endpoint_id}",
        "PUT",
        {
            "StackFileContent": Path(os.environ["STACK_FILE"]).read_text(),
            "Env": environment,
            "PullImage": True,
            "Prune": False,
        },
    )
    print("Portainer accepted the stack update; waiting for all four services to become healthy.")
    docker = f"/endpoints/{endpoint_id}/docker"
    query = urlencode({"all": "true", "filters": json.dumps({"label": [f"com.docker.compose.project={stack['Name']}"]})})
    deadline = time.monotonic() + 300
    expected = {"backend": images["BACKEND_IMAGE"], "frontend": images["FRONTEND_IMAGE"]}
    while time.monotonic() < deadline:
        ready = set()
        for container in api(f"{docker}/containers/json?{query}"):
            labels = container.get("Labels", {})
            service = labels.get("com.docker.compose.service")
            if service not in {"db", "backend", "frontend", "proxy"}:
                continue
            if labels.get("com.docker.compose.oneoff", "false").lower() == "true":
                continue
            details = api(f"{docker}/containers/{container['Id']}/json")
            state = details["State"]
            if service in expected and details["Config"]["Image"] != expected[service]:
                continue
            if state.get("Running") and state.get("Health", {}).get("Status") == "healthy":
                ready.add(service)
        if ready == {"db", "backend", "frontend", "proxy"}:
            domain = next(entry["value"] for entry in environment if entry["name"] == "SITE_DOMAIN")
            if not re.fullmatch(r"[a-z0-9]+(?:[.-][a-z0-9]+)*\.[a-z]{2,}", domain):
                raise ValueError("SITE_DOMAIN must be a lowercase public DNS name")
            for path in ("/api/v1/health/", "/robots.txt", "/static/admin/css/base.css"):
                with urlopen(f"https://{domain}{path}", timeout=30) as response:
                    if response.status != 200:
                        raise RuntimeError("Public HTTPS readiness check failed")
            print("Both requested image digests are running; containers and public HTTPS checks passed.")
            return
        time.sleep(5)
    raise RuntimeError("Stack did not become healthy within 300 seconds; inspect Portainer logs")


if __name__ == "__main__":
    try:
        deploy()
    except (ValueError, KeyError, RuntimeError, OSError, StopIteration) as error:
        # Avoid tracebacks and server response bodies that could reveal credentials.
        print(f"Deployment failed ({type(error).__name__}). Inspect Portainer and its container logs.")
        raise SystemExit(1) from None
