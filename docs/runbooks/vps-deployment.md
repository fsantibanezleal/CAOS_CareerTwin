# VPS deployment

Target shape: Linux VPS, Docker Compose v2, TLS reverse proxy, PostgreSQL/pgvector, Redis, ClamAV, app, worker, private volumes, Prometheus-compatible metrics, and encrypted off-host backups.

1. Create a dedicated unprivileged deployment directory and service account.
2. Clone/fetch the reviewed tag or exact commit. Never deploy a mutable working tree.
3. Create private `.env` with `APP_ENV=production`, `APP_PORT=8000`, a free loopback-only `CAREERTWIN_BIND_PORT`, HTTPS public URL, `ALLOWED_ORIGINS` as a JSON array or comma-separated explicit HTTPS origins, unique app/CSRF/PostgreSQL secrets, `SECURE_COOKIES=true`, and optional provider/Langfuse keys. Restrict file permissions. Do not enable generic prompt/output capture around the redacted Langfuse contract.
4. Configure DNS/TLS and reverse-proxy body/rate/time limits. Forward only trusted proxy headers.
5. Pull/build images, run the migration service once, and start app/worker dependencies.
6. Bootstrap the superuser through an interactive process inside the app container; do not place its password in Compose, Git, or a deployment log.
7. Verify liveness and dependency readiness, security headers, invite-only login, password change, two-account isolation, profile interchange/JSON Resume round-trip, upload/quarantine/review, opportunity snapshots/target portfolios, deterministic match/readiness edits, contacts/calendar import idempotency, mock and configured durable provider queue/cancel/retry, restart persistence, backup, and isolated restore.
8. Record commit, image digest, migration revision, health evidence, backup/restore identifiers, and rollback criteria in the private deployment register.

Rollback application containers to the prior image only if the database migration remains compatible. Never run a destructive Alembic downgrade on production data; restore an isolated verified backup and plan a forward fix.
