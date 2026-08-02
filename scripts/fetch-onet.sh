#!/usr/bin/env sh
set -eu
REPO_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
OUTPUT_DIRECTORY=${1:-data/private/taxonomies}
TARGET_DIRECTORY="$REPO_ROOT/$OUTPUT_DIRECTORY"
TARGET="$TARGET_DIRECTORY/db_30_3_text.zip"
URI='https://www.onetcenter.org/dl_files/database/db_30_3_text.zip'
EXPECTED_SHA256='7758ec966fd91895b3d290b83c9f1f1d46730d37fdda4faac67104d1c0d2a780'

mkdir -p "$TARGET_DIRECTORY"
if [ ! -f "$TARGET" ]; then
  curl --fail --location --proto '=https' --tlsv1.2 "$URI" --output "$TARGET"
fi
ACTUAL_SHA256=$(sha256sum "$TARGET" | awk '{print $1}')
if [ "$ACTUAL_SHA256" != "$EXPECTED_SHA256" ]; then
  echo 'O*NET 30.3 archive checksum mismatch. Remove the private archive and review upstream before retrying.' >&2
  exit 1
fi
echo "Verified O*NET 30.3 at $TARGET (sha256=$ACTUAL_SHA256)"
echo "Import with: careertwin import-onet --archive '$TARGET' --release 30.3 --replace"
