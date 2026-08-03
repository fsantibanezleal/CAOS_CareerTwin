# Native local development

## Prerequisites

- Python 3.11 or newer on `PATH`.
- Node.js 24 LTS and npm 11. `.nvmrc` and `.node-version` pin the tested line; `frontend/package.json` declares engine and package-manager compatibility.
- No Docker, PostgreSQL, Redis, or local model service is required.

`ALLOWED_ORIGINS` accepts a JSON string array or comma-separated explicit HTTP(S) origins. Wildcards,
credentials, paths, queries, and fragments are rejected.

## Install

Windows:

```powershell
./scripts/setup.ps1
./scripts/bootstrap-superuser.ps1 -Email you@example.com -DisplayName "Your Name"
```

Linux/macOS:

```sh
./scripts/setup.sh
./scripts/bootstrap-superuser.sh you@example.com "Your Name" en
```

Setup performs these idempotent steps:

1. Create ignored `.env` from names/placeholders and generate unique local secrets.
2. Create repo-root `.venv` and install `.[dev,observability]` into it.
3. Verify Node 24/npm 11 and require `frontend/package-lock.json`.
4. Run `npm ci --no-audit --no-fund` inside `frontend`, producing ignored `frontend/node_modules`.
5. Run Alembic against the ignored local SQLite database.

The bootstrap password is read without echo. Do not put it in `.env`, a shell argument, a committed
file, or documentation. The account is stored only in the ignored database.

## Run

```powershell
./scripts/dev.ps1
./scripts/career.ps1 doctor
```

The native process set is:

- Vite web client: `http://127.0.0.1:5173`
- FastAPI/OpenAPI: `http://127.0.0.1:8000` and `/api/docs`
- Database-backed worker: separate `.venv` Python process
- SQLite and encrypted blobs: ignored local data paths

PIDs and logs live under ignored `.run`. Stop only those recorded processes with
`scripts/stop.ps1`/`.sh`.

Optional Compose packaging is explicit: `scripts/dev.ps1 -Docker` or `scripts/dev.sh --docker`;
stop it with the matching Docker flag. Do not use that path as a local prerequisite.

## Skill/harness operation

```powershell
./scripts/career.ps1 profile-graph
./scripts/career.ps1 opportunity-graph
./scripts/career.ps1 get /api/pipeline/tasks
./scripts/career.ps1 request POST /api/profile/skills --json-file .\data\private\skill.json
```

The harness prompts for login without echo and retains cookies/CSRF only in memory. For unattended
local automation, set `CAREERTWIN_LOCAL_URL`, `CAREERTWIN_LOCAL_EMAIL`, and process-only
`CAREERTWIN_LOCAL_PASSWORD`; remove the password environment value afterward. Connector tokens have
separate process-only variables and are never persisted by the harness.

## External providers

The graphs, deterministic matching, pipeline, and basic text/PDF/DOCX parsing work without AI.
Chat and rich typed extraction require a managed-provider key in ignored `.env`. Image and scanned
PDF understanding plus voice require xAI. See [providers](providers.md).

## Verification

`scripts/test.*` runs Ruff, strict mypy, Pytest, agent evaluations, representative-volume checks,
ESLint, Vitest/axe, TypeScript, Vite build, and Spanish literal-key coverage. `scripts/verify.*` adds
live health/header checks. Tests use synthetic/ephemeral data and cannot target production.

Runtime databases, blobs, logs, PIDs, exports, backups, personal JSON bodies, and screenshots must
remain ignored. Use synthetic data for public issues and documentation.
