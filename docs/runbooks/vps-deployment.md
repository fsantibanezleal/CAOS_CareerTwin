# Lightweight VPS deployment

The hosted app is one interface over the repository product. The VPS runs web/API, a database-backed
worker, PostgreSQL, encrypted blobs, and required malware scanning behind TLS. It does not run
Ollama, Docling, an embedding service, an audio model, Redis, or ARQ.

## Release preparation

1. Deploy only a reviewed tag or exact commit from a clean worktree.
2. Create/verify an encrypted off-host database/blob backup and isolated restore before schema changes.
3. Create private runtime `.env` outside Git with `APP_ENV=production`, public HTTPS origin, explicit `ALLOWED_ORIGINS`, secure cookies, unique app/CSRF/PostgreSQL secrets, and unique 32-byte blob/connector AES keys.
4. Configure `LLM_DEFAULT_PROVIDER` plus the chosen managed-provider key. xAI is required for Grok Voice and image/scanned-PDF understanding. No provider key belongs in an image or Compose literal.
5. Keep optional Google/Microsoft OAuth registrations environment-only and match callbacks exactly to the HTTPS origin.

## Deploy

1. Bind the app port to loopback and expose only the TLS reverse proxy. Configure body, connection, request-rate, and provider-time limits.
2. Build/pull the reviewed application and PostgreSQL images. Confirm Compose contains no local inference, Docling, Redis, or model volumes.
3. When the PostgreSQL libc or locale changes, keep app/worker stopped and execute the physical-volume
   collation gate in the [backup and restore runbook](backup-restore.md): reindex and refresh only
   versioned databases, preserve `template0` as unversioned, and verify a warning-free database
   restart plus the expected pgvector version.
4. Start PostgreSQL and malware scanning, run the one-shot Alembic migration, then start app and worker.
5. Mount the same encrypted blob volume into app/worker. Keep PostgreSQL and blob volumes persistent; the worker queue needs no separate volume.
6. Import operator-downloaded pinned ESCO/O*NET datasets only when needed. Do not generate local embeddings or commit dataset archives.

## Verification

Verify through the public HTTPS origin with synthetic data:

- liveness/readiness, security headers, login/password change, and two-account isolation;
- superuser lifecycle controls with no cross-account content surface;
- encrypted native profile upload, worker progress, proposed evidence review, and portability;
- professional and opportunity graph endpoints plus network/matrix/table UI;
- opportunity versions, target sets, deterministic match/recommendations, and candidate pipeline;
- GitHub memory-only token path and configured OAuth connector availability/disconnect;
- a real external-provider durable chat with citations, cancel/retry, and worker restart persistence;
- Grok Voice ephemeral credential and browser-to-xAI audio when xAI is configured;
- backup creation and isolated restore.
- recorded/actual collation equality for every versioned database and the release's exact pgvector
  extension version after any PostgreSQL runtime change.

Run `scripts/release-smoke.py` with disposable account values supplied only through
`CAREERTWIN_SMOKE_*` process environment. It purges the temporary seeker in `finally` and never
prints credentials. Record commit/image digest, migration revision, configured provider name (not
key), dataset releases, health/test evidence, backup/restore identifiers, and rollback criteria.

## Rollback and incidents

Rollback the application only when the schema remains compatible. Never run a destructive Alembic
downgrade on production data. If a secret may have been exposed, rotate it before repository/history
cleanup. If an external provider is unavailable, deterministic core features remain available while
agent/image/voice surfaces report an explicit unconfigured/unavailable state.
