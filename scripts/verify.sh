#!/usr/bin/env sh
set -eu
REPO_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
"$REPO_ROOT/scripts/test.sh"
URL=${1:-http://127.0.0.1:8000}
curl --fail --silent --show-error "$URL/api/health/live" >/dev/null
HEADERS=$(curl --fail --silent --show-error -I "$URL/")
printf '%s' "$HEADERS" | grep -qi 'x-content-type-options: nosniff'
printf '%s' "$HEADERS" | grep -qi 'x-frame-options: deny'
printf '%s' "$HEADERS" | grep -qi 'content-security-policy:'
echo 'Runtime and response-security verification passed.'
