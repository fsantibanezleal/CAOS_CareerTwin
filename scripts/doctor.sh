#!/usr/bin/env sh
set -eu
REPO_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$REPO_ROOT"
python3 --version
node --version
git --version
command -v docker >/dev/null && docker --version || true
[ -x .venv/bin/python ] && .venv/bin/python -m careertwin.cli doctor || true
URL=${1:-http://127.0.0.1:8000}
curl --fail --silent --show-error "$URL/api/health/live" || echo 'Runtime not reachable; start it with scripts/dev.sh.'
