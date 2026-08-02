#!/usr/bin/env sh
set -eu
REPO_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$REPO_ROOT"
[ -f .env ] || { echo 'Run scripts/setup.sh first.' >&2; exit 1; }
if [ "${1:-}" != '--code' ]; then
  docker compose up --build -d
  docker compose ps
  echo 'CareerTwin is starting at http://localhost:8000.'
  exit 0
fi
mkdir -p .run
.venv/bin/python -m alembic upgrade head
nohup .venv/bin/python -m uvicorn careertwin.main:app --host 127.0.0.1 --port 8000 --reload >.run/api.out.log 2>.run/api.err.log &
echo $! >.run/api.pid
(cd frontend && nohup npm run dev >../.run/web.out.log 2>../.run/web.err.log & echo $! >../.run/web.pid)
echo 'Code mode started: web http://127.0.0.1:5173, API http://127.0.0.1:8000.'
