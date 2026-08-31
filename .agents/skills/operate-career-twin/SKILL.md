---
name: operate-career-twin
description: Set up, run, diagnose, back up, restore-test, upgrade, and deploy CareerTwin. Use for native local development, repo-local Python and Node dependencies, superuser bootstrap, SQLite or PostgreSQL operations, the database-backed worker, external model-provider configuration, optional Docker packaging, health checks, VPS releases, or incident response. Never commit secrets, runtime data, tokens, personal exports, database files, or backup archives.
---

# Operate CareerTwin

Skill contract version: 2.0.0.

## Source of truth

Read `Entry_point.md`, then `references/operator-contract.md` and the relevant file under `docs/runbooks/`. Treat `.env.example` as names and placeholders only. Runtime `.env`, passwords, provider keys, database contents, blobs, backups, and exports are private.

## Native local workflow

1. Run `scripts/setup.ps1` on Windows or `scripts/setup.sh` on Linux/macOS.
2. Verify that setup created repo-root `.venv`, installed the Python dependency contract, installed the frontend lockfile into `frontend/node_modules`, initialized ignored `.env`, and migrated the default ignored SQLite database. Never use a global Python environment or a global Node package install.
3. Create the first account with `scripts/bootstrap-superuser.ps1` or `.sh`. Supply the password through the hidden prompt or a one-process environment variable; never echo it or write it to `.env`.
4. Start the native API, database-backed worker, and Vite web client with `scripts/dev.ps1` or `.sh`.
5. Run `scripts/career.ps1 doctor` or `scripts/career.sh doctor`, then `scripts/verify.ps1` or `.sh`.
6. Stop only the recorded repo-local processes with `scripts/stop.ps1` or `.sh`.

Use `-Docker`/`--docker` only when explicitly testing the optional packaging/deployment profile. Docker is not a local prerequisite.

## Production workflow

1. Keep the VPS a lightweight web/API/worker deployment. Use PostgreSQL, TLS, secure cookies, private encrypted blob storage, malware scanning, and encrypted off-host backups. Do not install Redis, Ollama, Docling, or any local inference service.
2. Inject secrets from the VPS secret store. Never bake them into an image, Compose file, CI log, GitHub output, or shell history.
3. Back up before migrations. Deploy an immutable image or pinned commit. Run migrations once as the database owner.
4. Verify liveness, readiness, login, tenant isolation, encrypted upload/extraction/review/portability, opportunity snapshots, graphs, match semantics, artifacts, connectors, database-backed queue/cancel/retry, the configured external provider, and restart persistence.
5. Run a restore test to an isolated database and record the evidence. A backup without a restore test is not verified.
6. If Langfuse is configured, verify that only the redacted run-metadata contract is emitted.

Production agent work must use an explicitly configured external provider. Mock/test and local-inference providers are forbidden outside isolated tests.

## Incident rules

- Revoke sessions after suspected credential exposure.
- Rotate the affected application, provider, OAuth, blob, or connector key without pasting it into an issue.
- Preserve redacted logs and audit events.
- Prefer disabling an account to purge. Purge requires exact confirmation and a validated backup decision.

## Completion

Report version/commit, migration revision, health results, Python and Node gates, backup and restore-test identifiers, deployment target, and every incomplete check. Never print credentials or personal data.
