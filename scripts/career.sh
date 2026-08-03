#!/usr/bin/env sh
set -eu
REPO_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
[ -x "$REPO_ROOT/.venv/bin/python" ] || { echo 'Run scripts/setup.sh first; the repository .venv is missing.' >&2; exit 1; }
cd "$REPO_ROOT"
exec .venv/bin/python -m careertwin.harness "$@"
