#!/usr/bin/env sh
set -eu
REPO_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$REPO_ROOT"
if [ "${1:-}" != '--code' ]; then docker compose down; exit 0; fi
for name in api web; do
  path=".run/$name.pid"
  if [ -f "$path" ]; then
    pid=$(cat "$path")
    kill "$pid" 2>/dev/null || true
    rm -f "$path"
  fi
done
echo 'CareerTwin code-mode processes stopped.'
