#!/usr/bin/env sh
set -eu
REPO_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$REPO_ROOT"
sh scripts/init-env.sh
command -v python3 >/dev/null || { echo 'Python 3.11 or newer is required.' >&2; exit 1; }
python3 -c 'import sys; raise SystemExit(0 if sys.version_info >= (3, 11) else 1)' || { echo 'Python 3.11 or newer is required.' >&2; exit 1; }
command -v node >/dev/null || { echo 'Node.js 24 LTS is required.' >&2; exit 1; }
command -v npm >/dev/null || { echo 'npm 11 is required.' >&2; exit 1; }
node -e 'const [major] = process.versions.node.split(".").map(Number); if (major !== 24) process.exit(1)' || { echo 'Node.js 24 LTS is required.' >&2; exit 1; }
npm --version | awk -F. '{ exit !($1 == 11) }' || { echo 'npm 11 is required.' >&2; exit 1; }
[ -f frontend/package-lock.json ] || { echo 'frontend/package-lock.json is required for a reproducible install.' >&2; exit 1; }
[ -x .venv/bin/python ] || python3 -m venv .venv
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -e '.[dev,observability]'
(cd frontend && npm ci --no-audit --no-fund)
.venv/bin/python -m alembic upgrade head
echo 'CareerTwin native setup complete in .venv with frontend/node_modules. Run scripts/bootstrap-superuser.sh, then scripts/dev.sh.'
