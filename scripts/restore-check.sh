#!/usr/bin/env sh
set -eu
if [ "$#" -ne 1 ]; then echo 'Usage: restore-check.sh backups/private/careertwin-TIMESTAMP.sql' >&2; exit 2; fi
REPO_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$REPO_ROOT"
case "$1" in /*|../*|*/../*) echo 'Restore-check input must stay inside the working copy.' >&2; exit 2;; esac
[ -f "$1" ] || { echo 'Backup file does not exist.' >&2; exit 2; }
CHECK_DB=careertwin_restore_check
docker compose exec -T db dropdb --if-exists -U careertwin "$CHECK_DB"
docker compose exec -T db createdb -U careertwin "$CHECK_DB"
trap 'docker compose exec -T db dropdb --if-exists -U careertwin "$CHECK_DB"' EXIT
docker compose exec -T db psql -v ON_ERROR_STOP=1 -U careertwin -d "$CHECK_DB" <"$1"
docker compose exec -T db psql -U careertwin -d "$CHECK_DB" -c "SELECT count(*) AS schema_tables FROM information_schema.tables WHERE table_schema = 'public';"
echo 'Isolated database restore check passed.'
