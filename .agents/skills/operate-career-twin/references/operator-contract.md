# Operator contract

## Native runtime

- Python lives in repo-root `.venv`; Node packages live in `frontend/node_modules` and come only from `npm ci` plus `frontend/package-lock.json`.
- Node 24 LTS and npm 11 are pinned by repository metadata. Python 3.11 or newer is required.
- Native local use defaults to an ignored SQLite database. `scripts/dev.*` starts API, worker, and web without Docker; `scripts/stop.*` stops only recorded repo-local processes.
- `scripts/career.*` is the credential-safe automation surface for repository skills. It retains cookies and CSRF state only in memory and reads passwords/tokens from a hidden prompt or process environment.
- Docker Compose is an optional deployment/packaging profile, never a prerequisite.

## Production runtime

- Set `APP_ENV=production`, unique high-entropy application and CSRF secrets, and `SECURE_COOKIES=true`.
- Use PostgreSQL through the SQLAlchemy PostgreSQL driver, TLS termination, trusted proxy configuration, request-body limits, malware scanning, and encrypted off-host backups.
- Keep blob and connector encryption keys unique, runtime-only, and covered by private restore procedures.
- Keep external-provider keys environment-only. Production agent features require at least one managed provider; mock/test modes and local inference are invalid runtime configurations.
- Do not deploy Ollama, Docling, a local embedding server, Redis, or ARQ. The worker claims durable source and agent-run rows directly from the database and recovers interrupted work conservatively.
- Liveness is `/api/health/live`, dependency readiness is `/api/health/ready`, metrics are `/metrics`, and API documentation is `/api/docs`.
- Control schema changes through Alembic. Never use a destructive downgrade on production data.
- Superusers manage account lifecycle only and have no cross-account career-content browser.
- Keep ESCO/O*NET release provenance; lexical and graph retrieval changes must pass the pinned benchmark.
- Release gates include backend tests, Ruff, strict mypy, frontend type/build, zero-warning lint, i18n coverage, accessibility, and the representative fixture.
