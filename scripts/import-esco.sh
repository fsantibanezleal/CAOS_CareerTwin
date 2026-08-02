#!/usr/bin/env sh
set -eu
if [ "$#" -lt 2 ]; then echo 'Usage: import-esco.sh ARCHIVE en|es [--replace]' >&2; exit 2; fi
REPO_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$REPO_ROOT"
ARCHIVE=$(CDPATH= cd -- "$(dirname -- "$1")" && pwd)/$(basename -- "$1")
.venv/bin/python -m careertwin.cli import-esco --archive "$ARCHIVE" --language "$2" ${3:-}
