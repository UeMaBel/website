# Versioned container images

This page describes semantic-version releases. The automatic
[Portainer pipeline](portainer-deployment.md) also publishes `sha-<commit>`
images after CI succeeds on `main`, then deploys their immutable digests.

`.github/workflows/publish-images.yml` publishes the production backend and
frontend images to GitHub Container Registry (GHCR) after a semantic-version
tag points at a commit already integrated into `main`. It accepts only tags of
the form `vMAJOR.MINOR.PATCH` (for example, `v1.2.3`). Pull requests, branches,
pre-release suffixes, malformed versions, and tags on commits outside `main`
cannot publish. The workflow publishes only the version tag; it does not move a
`latest` tag.

The image names are:

```text
ghcr.io/<lowercase-owner>/personal-website-backend:vMAJOR.MINOR.PATCH
ghcr.io/<lowercase-owner>/personal-website-frontend:vMAJOR.MINOR.PATCH
```

The workflow currently builds `linux/amd64`, matching its Ubuntu runner and
the integrated container smoke. Confirm the eventual host architecture before
deployment; add a multi-platform manifest if the selected host requires another
architecture.

Before the first release, repository administrators must confirm that GitHub
Actions is allowed to write packages and decide whether the GHCR packages
should be public or private. The workflow uses the repository-scoped,
short-lived `GITHUB_TOKEN` with only `contents: read` and `packages: write`; it
does not need a personal access token, production environment secret, host, or
deployment credential. The package is linked to this repository with the OCI
source label. If the package already exists, grant this repository Actions
access to it with write permission in the package's **Manage Actions access**
settings. The registry namespace is the lowercase repository owner.

Protect `main` with required review and CI checks, and protect `v*` tags with a
repository ruleset that prevents updates and deletion. The workflow independently
checks that the tagged commit is an ancestor of `origin/main`; the ruleset keeps
an already-published version tag from being retargeted later. A release operator
merges the reviewed change, waits for required checks, then creates and pushes
its `vMAJOR.MINOR.PATCH` tag. Only then does the publish workflow run.

To verify the tag policy locally without publishing, from the repository root
set the environment to a known main commit and run the ref check. This checks the
release rule only; it does not create a tag or publish images:

```sh
GITHUB_REF_TYPE=tag GITHUB_REF_NAME=v1.2.3 GITHUB_SHA="$(git rev-parse origin/main)" \
  bash .github/scripts/verify-release-ref.sh
```

To repeat the production image build locally without registry access, provide
the same synthetic tag context and leave `PUBLISH_IMAGES` unset (the default is
false):

```sh
GITHUB_REF_TYPE=tag GITHUB_REF_NAME=v1.2.3 \
GITHUB_SHA="$(git rev-parse origin/main)" \
GITHUB_REPOSITORY=example/website GITHUB_REPOSITORY_OWNER=example \
  bash .github/scripts/build-release-images.sh
```

The local command builds both production targets into the local Docker image
store. It never logs in or pushes. GitHub's [package publishing guidance](https://docs.github.com/en/packages/managing-github-packages-using-github-actions-workflows/publishing-and-installing-a-package-with-github-actions)
describes the `GITHUB_TOKEN` permissions and package Actions-access settings.
