# Container integration checks

The workflow is also reusable by [automatic Portainer delivery](portainer-deployment.md).
It validates the merged image-only Portainer Compose configuration in addition
to the local stack smoke checks below. The deployment controller's offline
contract checks run in that delivery pipeline before image publication.

`.github/workflows/container-integration.yml` validates both Compose files,
builds the backend and frontend production images, starts the disposable local
Compose stack, and checks backend readiness, public server rendering, Django
admin static assets, media headers/content, and public draft exclusion. The
workflow runs on pushes and pull requests without production secrets. It writes
throwaway database and Django secrets, uses a loopback-only random port, and
removes its containers, volumes, and credentials after the run. If a check
fails, the workflow prints Compose logs and uploads them for seven days.

Run the same validation locally from the repository root with Docker and the
Compose plugin installed:

```sh
bash .github/scripts/compose-smoke.sh
```

The script selects an available loopback port with Python 3. To choose one
explicitly (for example, in Git Bash on Windows), set `CI_PROXY_PORT`:

```sh
CI_PROXY_PORT=31080 bash .github/scripts/compose-smoke.sh
```

The script creates a synthetic draft and a text file only in its temporary
Compose project. It verifies the public blog list omits the draft, the public
detail returns 404, the unauthenticated preview returns 401, and the public SSR
route returns 404 without the draft title. It also checks media is served with
`nosniff` and a sandbox content policy. All test data is destroyed when the
script exits.
