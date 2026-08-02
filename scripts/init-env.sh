#!/usr/bin/env sh
set -eu
REPO_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$REPO_ROOT"
if [ -f .env ]; then
  echo 'Using existing ignored .env; no values were changed.'
  exit 0
fi
command -v python3 >/dev/null || { echo 'Python 3.11 or newer is required.' >&2; exit 1; }
cp .env.example .env
APP_VALUE=$(python3 -c 'import secrets; print(secrets.token_urlsafe(48))')
CSRF_VALUE=$(python3 -c 'import secrets; print(secrets.token_urlsafe(48))')
PG_VALUE=$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')
BLOB_VALUE=$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')
CONNECTOR_VALUE=$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')
DOCLING_VALUE=$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')
sed -i.bak "s|^APP_SECRET_KEY=$|APP_SECRET_KEY=$APP_VALUE|; s|^APP_CSRF_SECRET=$|APP_CSRF_SECRET=$CSRF_VALUE|; s|^POSTGRES_PASSWORD=$|POSTGRES_PASSWORD=$PG_VALUE|; s|^BLOB_ENCRYPTION_KEY=$|BLOB_ENCRYPTION_KEY=$BLOB_VALUE|; s|^CONNECTOR_ENCRYPTION_KEY=$|CONNECTOR_ENCRYPTION_KEY=$CONNECTOR_VALUE|; s|^DOCLING_API_KEY=$|DOCLING_API_KEY=$DOCLING_VALUE|" .env
rm -f .env.bak
echo 'Created ignored .env with generated local secrets.'
