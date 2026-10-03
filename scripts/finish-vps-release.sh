#!/usr/bin/env bash
# Explicit post-release acceptance and bounded rollback retention, never a cron job.
set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."
if [[ $# -ne 1 || "$1" != "--apply" ]]; then
  echo 'Usage: scripts/finish-vps-release.sh --apply (after full release verification)' >&2
  exit 2
fi
python3 "$SCRIPT_DIR/vps-images.py" checkpoint
python3 "$SCRIPT_DIR/vps-images.py" plan
python3 "$SCRIPT_DIR/vps-images.py" clean --apply --prune-cache
python3 "$SCRIPT_DIR/vps-images.py" preflight
