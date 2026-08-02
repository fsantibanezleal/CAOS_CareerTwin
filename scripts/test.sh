#!/usr/bin/env sh
set -eu
REPO_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$REPO_ROOT"
.venv/bin/python -m ruff check backend docling_gateway tests evals scripts/representative-load.py
.venv/bin/python -m mypy backend docling_gateway evals
.venv/bin/python -m pytest
.venv/bin/python evals/agent_contract.py
.venv/bin/python scripts/representative-load.py
(cd frontend && npm run lint && npm test && npm run build)
echo 'All local quality gates passed.'
