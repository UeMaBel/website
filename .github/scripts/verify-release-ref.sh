#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${GITHUB_REF_TYPE:-}" != "tag" ]]; then
  echo "Image publication requires a Git tag event." >&2
  exit 1
fi

release_tag="${GITHUB_REF_NAME:-}"
if [[ ! "$release_tag" =~ ^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]]; then
  echo "Release tags must use vMAJOR.MINOR.PATCH without leading zeroes or suffixes." >&2
  exit 1
fi

release_commit="${GITHUB_SHA:-}"
if [[ ! "$release_commit" =~ ^[0-9a-fA-F]{40}$ ]]; then
  echo "GITHUB_SHA must identify the tagged commit." >&2
  exit 1
fi

main_ref="refs/remotes/origin/main"
if ! git show-ref --verify --quiet "$main_ref"; then
  echo "Missing origin/main; check out full repository history before publishing." >&2
  exit 1
fi

if ! git merge-base --is-ancestor "$release_commit" "$main_ref"; then
  echo "Release commit $release_commit is not integrated into origin/main." >&2
  exit 1
fi

echo "Verified $release_tag points to a commit integrated into origin/main."
