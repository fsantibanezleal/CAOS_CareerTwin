#!/usr/bin/env sh
set -eu
if [ "$#" -lt 2 ]; then
  echo 'Usage: bootstrap-superuser.sh EMAIL DISPLAY_NAME [en|es] [--compose] [--force-password-change]' >&2
  exit 2
fi
REPO_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$REPO_ROOT"
EMAIL=$1
DISPLAY_NAME=$2
shift 2
LOCALE=en
if [ "$#" -gt 0 ] && { [ "$1" = en ] || [ "$1" = es ]; }; then LOCALE=$1; shift; fi
COMPOSE=false
FORCE_CHANGE=false
for option in "$@"; do
  case "$option" in
    --compose) COMPOSE=true ;;
    --force-password-change) FORCE_CHANGE=true ;;
    *) echo "Unknown option: $option" >&2; exit 2 ;;
  esac
done
echo 'The password will be requested without echo and is never written by this script.'
if [ "$COMPOSE" = true ]; then
  if [ "$FORCE_CHANGE" = true ]; then
    docker compose exec app careertwin bootstrap-superuser --email "$EMAIL" --display-name "$DISPLAY_NAME" --locale "$LOCALE"
  else
    docker compose exec app careertwin bootstrap-superuser --email "$EMAIL" --display-name "$DISPLAY_NAME" --locale "$LOCALE" --no-force-change
  fi
elif [ "$FORCE_CHANGE" = true ]; then
  .venv/bin/python -m careertwin.cli bootstrap-superuser --email "$EMAIL" --display-name "$DISPLAY_NAME" --locale "$LOCALE"
else
  .venv/bin/python -m careertwin.cli bootstrap-superuser --email "$EMAIL" --display-name "$DISPLAY_NAME" --locale "$LOCALE" --no-force-change
fi
