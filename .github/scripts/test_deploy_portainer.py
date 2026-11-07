"""Offline contract checks for the deployment controller; no server is contacted."""

import importlib.util
import io
import json
import os
from pathlib import Path
import unittest
from unittest.mock import patch


spec = importlib.util.spec_from_file_location("deployment", Path(__file__).with_name("deploy-portainer.py"))
deployment = importlib.util.module_from_spec(spec)
spec.loader.exec_module(deployment)


class DeploymentTests(unittest.TestCase):
    def setUp(self):
        self.env = {
            "PORTAINER_URL": "https://portainer.example.com",
            "PORTAINER_STACK_ID": "7",
            "PORTAINER_ENDPOINT_ID": "2",
            "PORTAINER_API_KEY": "test-key",
            "BACKEND_IMAGE": "ghcr.io/example/backend@sha256:" + "a" * 64,
            "FRONTEND_IMAGE": "ghcr.io/example/frontend@sha256:" + "b" * 64,
            "STACK_FILE": "unused-test-file",
        }
        self.stack = {
            "Name": "personal-website-production", "Type": 2, "EndpointId": 2,
            "Env": [{"name": "POSTGRES_PASSWORD", "value": "preserved-secret"},
                    {"name": "SITE_DOMAIN", "value": "example.com"},
                    {"name": "BACKEND_IMAGE", "value": "old-image"}],
        }
        self.updates = []

    def response(self, request, **kwargs):
        if isinstance(request, str):
            response = io.BytesIO(b"ok")
            response.status = 200
            return response
        url = request.full_url
        if request.method == "PUT":
            self.updates.append(json.loads(request.data))
            result = self.stack
        elif url.endswith("/stacks/7"):
            result = self.stack
        elif "/containers/json?" in url:
            result = [{"Id": service, "Labels": {"com.docker.compose.service": service}}
                      for service in ("db", "backend", "frontend", "proxy")]
        else:
            service = url.split("/")[-2]
            image = self.env.get(service.upper() + "_IMAGE", "infrastructure")
            result = {"State": {"Running": True, "Health": {"Status": "healthy"}},
                      "Config": {"Image": image}}
        return io.BytesIO(json.dumps(result).encode())

    def run_deploy(self):
        with patch.dict(os.environ, self.env), patch.object(deployment, "urlopen", side_effect=self.response), \
                patch.object(Path, "read_text", return_value="services: {}"), patch("builtins.print"):
            deployment.deploy()

    def test_preserves_secrets_and_updates_both_digests(self):
        self.run_deploy()
        payload, = self.updates
        values = {entry["name"]: entry["value"] for entry in payload["Env"]}
        self.assertEqual(values["POSTGRES_PASSWORD"], "preserved-secret")
        for name in ("BACKEND_IMAGE", "FRONTEND_IMAGE"):
            self.assertEqual(values[name], self.env[name])
        self.assertTrue(payload["PullImage"])
        self.assertFalse(payload["Prune"])

    def test_refuses_wrong_endpoint_before_mutation(self):
        self.stack["EndpointId"] = 99
        with self.assertRaises(ValueError):
            self.run_deploy()
        self.assertEqual(self.updates, [])

    def test_refuses_git_managed_stack_before_mutation(self):
        self.stack["GitConfig"] = {"URL": "https://example.com/repo"}
        with self.assertRaises(ValueError):
            self.run_deploy()
        self.assertEqual(self.updates, [])

    def test_rejects_mutable_image_tag(self):
        self.env["BACKEND_IMAGE"] = "ghcr.io/example/backend:latest"
        with self.assertRaises(ValueError):
            self.run_deploy()
        self.assertEqual(self.updates, [])

    def test_old_digest_is_not_ready(self):
        original = self.response

        def stale_image(request, **kwargs):
            if not isinstance(request, str) and request.full_url.endswith("/containers/backend/json"):
                return io.BytesIO(json.dumps({"State": {"Running": True, "Health": {"Status": "healthy"}},
                                             "Config": {"Image": "old-image"}}).encode())
            return original(request, **kwargs)

        self.response = stale_image
        with patch.object(deployment.time, "monotonic", side_effect=[0, 1, 301]), \
                patch.object(deployment.time, "sleep"), self.assertRaises(RuntimeError):
            self.run_deploy()


if __name__ == "__main__":
    unittest.main()
