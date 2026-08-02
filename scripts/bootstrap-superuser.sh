#!/usr/bin/env sh
set -eu
if [ "$#" -lt 2 ]; then echo 'Usage: bootstrap-superuser.sh EMAIL DISPLAY_NAME [en|es] [--compose]' >&2; exit 2; fi
REPO_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$REPO_ROOT"
EMAIL=$1
DISPLAY_NAME=$2
LOCALE=${3:-en}
echo 'The temporary password will be requested without echo and is never written by this script.'
if [ "${4:-}" = '--compose' ]; then
  docker compose exec app careertwin bootstrap-superuser --email "$EMAIL" --display-name "$DISPLAY_NAME" --locale "$LOCALE"
else
  .venv/bin/python -m careertwin.cli bootstrap-superuser --email "$EMAIL" --display-name "$DISPLAY_NAME" --locale "$LOCALE"
fi
