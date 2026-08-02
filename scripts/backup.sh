#!/usr/bin/env sh
set -eu
REPO_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$REPO_ROOT"
BACKUP_ROOT=${1:-backups/private}
case "$BACKUP_ROOT" in /*|../*|*/../*) echo 'Backup directory must stay inside the working copy.' >&2; exit 2;; esac
umask 077
mkdir -p "$BACKUP_ROOT"
chmod 700 "$BACKUP_ROOT"
STAMP=$(date -u +%Y%m%d-%H%M%S)
DATABASE_FILE="$BACKUP_ROOT/careertwin-$STAMP.sql"
BLOB_FILE="$BACKUP_ROOT/careertwin-blobs-$STAMP.tar.gz"
docker compose exec -T db pg_dump --clean --if-exists --no-owner -U careertwin -d careertwin >"$DATABASE_FILE"
docker compose exec -T app tar -czf /tmp/careertwin-blobs-backup.tar.gz -C /var/lib/careertwin blobs
docker compose cp app:/tmp/careertwin-blobs-backup.tar.gz "$BLOB_FILE"
docker compose exec -T app rm -f /tmp/careertwin-blobs-backup.tar.gz
chmod 600 "$DATABASE_FILE" "$BLOB_FILE"
echo "Private backup created under $BACKUP_ROOT. Run restore-check.sh before trusting it."
