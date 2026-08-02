# Local development

Install Python 3.11+ and Node.js 24 LTS first. If you use NVM, `nvm use` reads the repository `.nvmrc`; the setup scripts reject older Node releases before changing the workspace.

`ALLOWED_ORIGINS` accepts either a JSON string array or a comma-separated list of explicit HTTP(S)
origins. Wildcards, credentials, paths, queries, and fragments are rejected because authenticated
CORS requests require a closed allowlist.

## Windows

```powershell
./scripts/setup.ps1
./scripts/bootstrap-superuser.ps1 -Email you@example.com -DisplayName "Your Name"
./scripts/dev.ps1
```

Docker Compose is the default and starts PostgreSQL/pgvector, Redis, ClamAV, migration, app, and worker. Use `./scripts/dev.ps1 -Code` for FastAPI at port 8000 and Vite at 5173 using the `.env` database. Stop with `./scripts/stop.ps1` or `-Code`.

## Linux/macOS

```sh
./scripts/setup.sh
./scripts/bootstrap-superuser.sh you@example.com "Your Name" en
./scripts/dev.sh
```

Use `--code` for source mode. The setup script creates an ignored `.env` with local high-entropy secrets; review it without committing it.

## Verification

`scripts/test.*` runs Ruff, strict MyPy, Pytest, agent evaluations, the fixed representative-volume contract, ESLint, Vitest/axe, TypeScript, and the Vite production build. The volume fixture always creates an ephemeral synthetic SQLite database; it cannot target configured personal or production data. With an instance running, `scripts/verify.*` adds liveness and response-header checks. `scripts/doctor.*` reports tool/database/runtime availability without printing connection strings or credentials.

See [dependency maintenance](dependency-maintenance.md) before accepting automated updates.

## OpenAPI and data

Use `http://localhost:8000/api/docs`. Runtime databases, blobs, logs, PIDs, exports, and backups are ignored. Use synthetic data for development screenshots and issues.
