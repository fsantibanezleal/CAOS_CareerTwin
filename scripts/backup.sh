#!/usr/bin/env sh
set -eu
REPO_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$REPO_ROOT"
BACKUP_ROOT=${1:-backups/private}
case "$BACKUP_ROOT" in /*|../*|*/../*) echo 'Backup directory must stay inside the working copy.' >&2; exit 2;; esac
umask 077
mkdir -p "$BACKUP_ROOT"
chmod 700 "$BACKUP_ROOT"
BACKUP_ROOT_ABSOLUTE=$(CDPATH= cd -- "$BACKUP_ROOT" && pwd)
case "$BACKUP_ROOT_ABSOLUTE" in "$REPO_ROOT"/*) :;; *) echo 'Backup directory must resolve inside the working copy.' >&2; exit 2;; esac
STAMP=$(date -u +%Y%m%d-%H%M%S)
DATABASE_FILE="$BACKUP_ROOT_ABSOLUTE/careertwin-$STAMP.sql"
BLOB_FILE="$BACKUP_ROOT_ABSOLUTE/careertwin-blobs-$STAMP.tar.gz"
BLOB_STAGE=$(mktemp -d "$BACKUP_ROOT_ABSOLUTE/.careertwin-blobs.XXXXXX")
cleanup() {
  case "$BLOB_STAGE" in
    "$BACKUP_ROOT_ABSOLUTE"/.careertwin-blobs.*) rm -rf -- "$BLOB_STAGE";;
    *) echo 'Refusing to clean an unexpected blob staging path.' >&2;;
  esac
}
trap cleanup EXIT HUP INT TERM
docker compose exec -T db pg_dump --clean --if-exists --no-owner -U careertwin -d careertwin >"$DATABASE_FILE"
docker compose cp app:/var/lib/careertwin/blobs "$BLOB_STAGE/blobs"
tar -czf "$BLOB_FILE" -C "$BLOB_STAGE" blobs
chmod 600 "$DATABASE_FILE" "$BLOB_FILE"
echo "Private backup created under $BACKUP_ROOT. Run restore-check.sh before trusting it."
