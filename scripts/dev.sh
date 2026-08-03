#!/usr/bin/env sh
set -eu
REPO_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$REPO_ROOT"
[ -f .env ] || { echo 'Run scripts/setup.sh first.' >&2; exit 1; }
if [ "${1:-}" = '--docker' ]; then
  docker compose up --build -d
  docker compose ps
  echo 'CareerTwin is starting at http://localhost:8000.'
  exit 0
fi
[ -x .venv/bin/python ] || { echo 'Run scripts/setup.sh first; the repository .venv is missing.' >&2; exit 1; }
[ -f frontend/node_modules/vite/bin/vite.js ] || { echo 'Run scripts/setup.sh first; frontend/node_modules is missing or incomplete.' >&2; exit 1; }
mkdir -p .run
for name in api worker web; do
  path=".run/$name.pid"
  if [ -f "$path" ] && kill -0 "$(cat "$path")" 2>/dev/null; then
    echo "CareerTwin $name is already running. Run scripts/stop.sh first." >&2
    exit 1
  fi
  rm -f "$path"
done
.venv/bin/python -m alembic upgrade head
nohup .venv/bin/python -m uvicorn careertwin.main:app --host 127.0.0.1 --port 8000 --reload >.run/api.out.log 2>.run/api.err.log &
echo $! >.run/api.pid
nohup .venv/bin/python -m careertwin.worker >.run/worker.out.log 2>.run/worker.err.log &
echo $! >.run/worker.pid
(cd frontend && nohup node node_modules/vite/bin/vite.js --host 127.0.0.1 >../.run/web.out.log 2>../.run/web.err.log & echo $! >../.run/web.pid)
sleep 1
for name in api worker web; do
  if ! kill -0 "$(cat ".run/$name.pid")" 2>/dev/null; then
    sh scripts/stop.sh
    echo 'A native CareerTwin process exited during startup. Inspect ignored .run/*.err.log files.' >&2
    exit 1
  fi
done
echo 'Native CareerTwin started: web http://127.0.0.1:5173, API http://127.0.0.1:8000, database-backed worker active.'
