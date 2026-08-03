#!/usr/bin/env sh
set -eu
REPO_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$REPO_ROOT"
python3 --version
node --version
npm --version
git --version
[ -x .venv/bin/python ] && echo 'python environment: repo .venv present' || echo 'python environment: repo .venv missing'
[ -d frontend/node_modules ] && echo 'node environment: frontend/node_modules present' || echo 'node environment: frontend/node_modules missing'
command -v docker >/dev/null && docker --version || true
[ -x .venv/bin/python ] && .venv/bin/python -m careertwin.cli doctor || true
URL=${1:-http://127.0.0.1:8000}
curl --fail --silent --show-error "$URL/api/health/live" || echo 'Runtime not reachable; start it with scripts/dev.sh.'
