#!/usr/bin/env sh
set -eu
REPO_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$REPO_ROOT"
.venv/bin/python -m ruff check backend tests evals
.venv/bin/python -m mypy backend evals
.venv/bin/python -m pytest
.venv/bin/python evals/agent_contract.py
(cd frontend && npm run lint && npm test && npm run build)
echo 'All local quality gates passed.'
