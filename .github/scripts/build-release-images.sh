#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${GITHUB_REF_TYPE:-}" != "tag" || ! "${GITHUB_REF_NAME:-}" =~ ^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]]; then
  echo "Refusing to build release images outside a vMAJOR.MINOR.PATCH tag." >&2
  exit 1
fi

case "${PUBLISH_IMAGES:-false}" in
  true|false) ;;
  *) echo "PUBLISH_IMAGES must be true or false." >&2; exit 2 ;;
esac

release_tag="$GITHUB_REF_NAME"
release_commit="${GITHUB_SHA:?GITHUB_SHA is required}"
bash "$(dirname "${BASH_SOURCE[0]}")/verify-release-ref.sh"
repository="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
owner="${GITHUB_REPOSITORY_OWNER:?GITHUB_REPOSITORY_OWNER is required}"
owner_lower="${owner,,}"
registry="ghcr.io"
source_url="https://github.com/$repository"
backend_local="personal-website-backend:$release_tag"
frontend_local="personal-website-frontend:$release_tag"
backend_remote="$registry/$owner_lower/personal-website-backend:$release_tag"
frontend_remote="$registry/$owner_lower/personal-website-frontend:$release_tag"

docker buildx inspect --bootstrap
docker buildx build \
  --file backend/Dockerfile \
  --target production \
  --tag "$backend_local" \
  --label "org.opencontainers.image.source=$source_url" \
  --label "org.opencontainers.image.version=$release_tag" \
  --label "org.opencontainers.image.revision=$release_commit" \
  --load backend
docker buildx build \
  --file frontend/Dockerfile \
  --target production \
  --tag "$frontend_local" \
  --label "org.opencontainers.image.source=$source_url" \
  --label "org.opencontainers.image.version=$release_tag" \
  --label "org.opencontainers.image.revision=$release_commit" \
  --load frontend

if [[ "${PUBLISH_IMAGES:-false}" == "false" ]]; then
  echo "PUBLISH_IMAGES=false; local builds completed without registry login or publication."
  exit 0
fi

: "${GITHUB_ACTOR:?GITHUB_ACTOR is required to publish images}"
: "${GHCR_TOKEN:?GHCR_TOKEN is required to publish images}"
printf '%s' "$GHCR_TOKEN" | docker login "$registry" --username "$GITHUB_ACTOR" --password-stdin
docker tag "$backend_local" "$backend_remote"
docker tag "$frontend_local" "$frontend_remote"
docker push "$backend_remote"
docker push "$frontend_remote"
docker logout "$registry"

echo "Published $backend_remote and $frontend_remote."
