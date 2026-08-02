#!/usr/bin/env sh
set -eu
REPO_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$REPO_ROOT"
BACKUP_ROOT=${1:-backups/private}
case "$BACKUP_ROOT" in /*|../*|*/../*) echo 'Backup directory must stay inside the working copy.' >&2; exit 2;; esac
mkdir -p "$BACKUP_ROOT"
STAMP=$(date -u +%Y%m%d-%H%M%S)
docker compose exec -T db pg_dump --clean --if-exists --no-owner -U careertwin -d careertwin >"$BACKUP_ROOT/careertwin-$STAMP.sql"
docker compose exec -T app tar -czf /tmp/careertwin-blobs-backup.tar.gz -C /var/lib/careertwin blobs
docker compose cp app:/tmp/careertwin-blobs-backup.tar.gz "$BACKUP_ROOT/careertwin-blobs-$STAMP.tar.gz"
docker compose exec -T app rm -f /tmp/careertwin-blobs-backup.tar.gz
echo "Private backup created under $BACKUP_ROOT. Run restore-check.sh before trusting it."
