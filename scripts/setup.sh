#!/usr/bin/env sh
set -eu
REPO_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$REPO_ROOT"
command -v python3 >/dev/null || { echo 'Python 3.11 or newer is required.' >&2; exit 1; }
command -v npm >/dev/null || { echo 'Node.js 24 LTS or newer is required.' >&2; exit 1; }
node -e 'const [major] = process.versions.node.split(".").map(Number); if (major < 24) process.exit(1)' || { echo 'Node.js 24 LTS or newer is required.' >&2; exit 1; }
[ -x .venv/bin/python ] || python3 -m venv .venv
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -e '.[dev]'
(cd frontend && npm ci)
if [ ! -f .env ]; then
  cp .env.example .env
  APP_VALUE=$(.venv/bin/python -c 'import secrets; print(secrets.token_urlsafe(48))')
  CSRF_VALUE=$(.venv/bin/python -c 'import secrets; print(secrets.token_urlsafe(48))')
  PG_VALUE=$(.venv/bin/python -c 'import secrets; print(secrets.token_urlsafe(32))')
  sed -i.bak "s|^APP_SECRET_KEY=$|APP_SECRET_KEY=$APP_VALUE|; s|^APP_CSRF_SECRET=$|APP_CSRF_SECRET=$CSRF_VALUE|; s|^POSTGRES_PASSWORD=$|POSTGRES_PASSWORD=$PG_VALUE|" .env
  rm -f .env.bak
  echo 'Created ignored .env with generated local secrets.'
fi
.venv/bin/python -m alembic upgrade head
echo 'CareerTwin setup complete. Run scripts/bootstrap-superuser.sh, then scripts/dev.sh.'
