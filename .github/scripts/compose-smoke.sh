#!/usr/bin/env bash
set -Eeuo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

ci_port="${CI_PROXY_PORT:-$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1]); s.close()')}"
if [[ ! "$ci_port" =~ ^[0-9]+$ ]]; then
  echo "CI_PROXY_PORT must be a numeric port." >&2
  exit 2
fi

ci_project="website-ci-${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-0}-$$"
ci_env_file="$(mktemp "${TMPDIR:-/tmp}/website-compose-ci.XXXXXX")"
home_html="$(mktemp "${TMPDIR:-/tmp}/website-home-ci.XXXXXX")"
admin_html="$(mktemp "${TMPDIR:-/tmp}/website-admin-ci.XXXXXX")"
media_body="$(mktemp "${TMPDIR:-/tmp}/website-media-ci.XXXXXX")"
draft_body="$(mktemp "${TMPDIR:-/tmp}/website-draft-ci.XXXXXX")"
list_body="$(mktemp "${TMPDIR:-/tmp}/website-list-ci.XXXXXX")"
preview_body="$(mktemp "${TMPDIR:-/tmp}/website-preview-ci.XXXXXX")"
ci_log="${CI_COMPOSE_LOG:-}"

if [[ -n "$ci_log" ]]; then
  mkdir -p "$(dirname "$ci_log")"
  : > "$ci_log"
fi

compose() {
  docker compose --project-name "$ci_project" --env-file "$ci_env_file" --file compose.yaml "$@"
}

cleanup() {
  local result=$?
  trap - EXIT
  if (( result != 0 )); then
    if [[ -n "$ci_log" ]]; then
      compose logs --no-color --timestamps > "$ci_log" 2>&1 || true
      cat "$ci_log" >&2
    else
      compose logs --no-color --timestamps >&2 || true
    fi
  fi
  compose down --volumes --remove-orphans --timeout 10 >/dev/null 2>&1 || true
  rm -f "$ci_env_file" "$home_html" "$admin_html" "$media_body" \
    "$draft_body" "$list_body" "$preview_body"
  exit "$result"
}
trap cleanup EXIT
trap 'echo "Compose smoke failed at line $LINENO (exit $?)." >&2' ERR

db_password="$(openssl rand -hex 32)"
django_secret="$(openssl rand -hex 32)"
cat > "$ci_env_file" <<EOF
POSTGRES_DB=website
POSTGRES_USER=website
POSTGRES_PASSWORD=$db_password
DJANGO_SECRET_KEY=$django_secret
DJANGO_DEBUG=true
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,backend
PROXY_PORT=$ci_port
PUBLIC_SITE_ORIGIN=http://localhost:$ci_port
SITE_DOMAIN=example.invalid
EOF
unset db_password django_secret

echo "Validating local and production Compose configurations."
compose config --quiet
docker compose --project-name "$ci_project-production" --env-file "$ci_env_file" \
  --file compose.production.yaml config --quiet

echo "Building frontend and backend production containers."
compose build backend frontend

echo "Starting the disposable local application stack."
compose up --detach --wait --wait-timeout 300
base_url="http://localhost:$ci_port"

echo "Checking backend health, public SSR, admin assets, and static files."
curl --retry 20 --retry-connrefused --retry-delay 2 --fail --silent --show-error \
  --resolve "localhost:$ci_port:127.0.0.1" "$base_url/api/v1/health/" >/dev/null
curl --fail --silent --show-error --resolve "localhost:$ci_port:127.0.0.1" \
  "$base_url/" --output "$home_html"
# Check rendered page structure without coupling the smoke test to marketing copy.
grep -qF '<h1 id="hero-title">' "$home_html"
curl --fail --silent --show-error --resolve "localhost:$ci_port:127.0.0.1" \
  "$base_url/admin/login/" --output "$admin_html"
grep -q 'admin/css/base.css' "$admin_html"
curl --fail --silent --show-error --resolve "localhost:$ci_port:127.0.0.1" \
  "$base_url/static/admin/css/base.css" >/dev/null

echo "Checking media serving and public draft exclusion."
compose exec --no-TTY backend python -c \
  "from pathlib import Path; marker=Path('/data/media/ci-smoke/marker.txt'); marker.parent.mkdir(parents=True, exist_ok=True); marker.write_text('ticket62-media-fixture\\n')"
curl --fail --silent --show-error --resolve "localhost:$ci_port:127.0.0.1" \
  "$base_url/media/ci-smoke/marker.txt" --output "$media_body"
grep -qx 'ticket62-media-fixture' "$media_body"
media_headers="$(curl --fail --silent --show-error --head --resolve "localhost:$ci_port:127.0.0.1" \
  "$base_url/media/ci-smoke/marker.txt")"
grep -qi '^X-Content-Type-Options: nosniff' <<< "$media_headers"
grep -qi '^Content-Security-Policy:.*sandbox' <<< "$media_headers"

compose exec --no-TTY backend python manage.py shell -c \
  "from django.contrib.auth import get_user_model; from blog.models import BlogPost; author, _ = get_user_model().objects.get_or_create(username='ci-smoke-author'); BlogPost.objects.get_or_create(slug='ci-private-draft', defaults={'title': 'CI private draft marker', 'author': author, 'body': 'fixture only', 'status': BlogPost.Status.DRAFT})"
curl --fail --silent --show-error --resolve "localhost:$ci_port:127.0.0.1" \
  "$base_url/api/v1/blog/posts/" --output "$list_body"
if grep -q 'ci-private-draft' "$list_body"; then
  echo "Draft appeared in the public blog listing." >&2
  exit 1
fi

draft_status="$(curl --silent --show-error --resolve "localhost:$ci_port:127.0.0.1" \
  --output "$draft_body" --write-out '%{http_code}' "$base_url/api/v1/blog/posts/ci-private-draft/")"
if [[ "$draft_status" != 404 ]]; then
  echo "Expected public draft detail to return 404, got $draft_status." >&2
  exit 1
fi
preview_status="$(curl --silent --show-error --resolve "localhost:$ci_port:127.0.0.1" \
  --output "$preview_body" --write-out '%{http_code}' \
  "$base_url/api/v1/blog/posts/ci-private-draft/preview/")"
if [[ "$preview_status" != 401 ]]; then
  echo "Expected unauthenticated draft preview to return 401, got $preview_status." >&2
  exit 1
fi
ssr_draft_status="$(curl --silent --show-error --resolve "localhost:$ci_port:127.0.0.1" \
  --output "$draft_body" --write-out '%{http_code}' "$base_url/blog/ci-private-draft")"
if [[ "$ssr_draft_status" != 404 ]] || grep -q 'CI private draft marker' "$draft_body"; then
  echo "Draft SSR should return 404 without exposing the draft title." >&2
  exit 1
fi

echo "Container integration smoke passed; disposable containers, volumes, and credentials will be removed."
