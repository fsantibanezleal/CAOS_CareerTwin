# VPS deployment

Target shape: Linux VPS, Docker Compose v2, TLS reverse proxy, PostgreSQL/pgvector, Redis, ClamAV, app, worker, private volumes, Prometheus-compatible metrics, and encrypted off-host backups.

1. Create a dedicated unprivileged deployment directory and service account.
2. Clone/fetch the reviewed tag or exact commit. Never deploy a mutable working tree.
3. Create private `.env` with `APP_ENV=production`, `APP_PORT=8000`, a free loopback-only `CAREERTWIN_BIND_PORT`, HTTPS public URL, `ALLOWED_ORIGINS` as a JSON array or comma-separated explicit HTTPS origins, unique app/CSRF/PostgreSQL secrets, `SECURE_COOKIES=true`, unique `BLOB_ENCRYPTION_KEY` and `CONNECTOR_ENCRYPTION_KEY` values, and a unique `DOCLING_API_KEY`. Restrict file permissions to the deployment account. Do not enable generic prompt/output capture around the redacted Langfuse contract.
4. Keep the default private provider (`LLM_DEFAULT_PROVIDER=ollama`, `OLLAMA_MODEL=qwen2.5:0.5b-instruct-q4_K_M`) unless a reviewed hosted provider is explicitly selected. The pinned small instruction model is the measured CPU-safe baseline for the 8 GB VPS; use a larger reviewed model only after a representative latency and memory benchmark. Provider credentials and optional Google/Microsoft OAuth client registrations remain environment-only. Exact OAuth callback URLs must match the public HTTPS origin.
5. Keep `WORKER_MAX_JOBS=2` on the reference 8 GB host. Higher concurrency competes for the single
   local-model slot and Docling memory; raise it only after a representative concurrent-ingestion test.
6. Configure DNS/TLS and reverse-proxy body/rate/time limits. Forward only trusted proxy headers.
7. Create and verify an encrypted off-host backup immediately before changing application or schema state. Record its private identifier without putting secret material in the release record.
8. Pull/build images with BuildKit caching enabled. Confirm the Docling image uses CPU-only Torch, imports the pinned source-built OpenCV, has no FFmpeg/GStreamer/V4L libraries, and converts representative English/Spanish OCR and table fixtures. Start PostgreSQL/Redis/ClamAV/Ollama/Docling, pull the exact configured Ollama chat and embedding models, run the migration service once, and start the app/worker. Confirm `/api/health/ready` before migration of legacy content.
9. After upgrading from an earlier release, run `careertwin encrypt-blobs` inside the app container. Verify every retained blob has the encrypted envelope before retiring any legacy key or backup.
10. Import operator-downloaded official ESCO 1.2.1 and O*NET 30.3 datasets with `careertwin import-esco` and `careertwin import-onet`, generate local vectors with `careertwin embed-taxonomy`, then run `python benchmarks/taxonomy_retrieval.py`. Never commit archives or extracted datasets.
11. Bootstrap the superuser through an interactive process inside the app container; do not place its password in Compose, Git, a deployment log, or the repository. Existing environments retain the private account rather than recreating it.
12. Verify liveness and dependency readiness, security headers, invite-only login, password change, two-account isolation, encrypted profile upload/private Docling extraction/review, interchange and JSON Resume round-trip, STAR/résumé artifacts, opportunity snapshots/target portfolios/browser capture, deterministic match/readiness edits, contacts/calendar import idempotency, connector availability/disconnect, a real durable provider queue/cancel/retry turn, restart persistence, backup, and isolated restore. Use synthetic data and purge it after verification.

For the synthetic live API portion, export `CAREERTWIN_SMOKE_BASE_URL`,
`CAREERTWIN_SMOKE_ADMIN_EMAIL`, `CAREERTWIN_SMOKE_ADMIN_PASSWORD`,
`CAREERTWIN_SMOKE_SEEKER_EMAIL`, and `CAREERTWIN_SMOKE_SEEKER_PASSWORD`, then run
`.venv/bin/python scripts/release-smoke.py` (or `.venv\Scripts\python.exe` on Windows).
The existing admin is retained; the script purges its temporary seeker in a `finally` block and
prints only non-sensitive counters.
13. Record commit, image digest, model digests, dataset releases, migration revision, health evidence, benchmark summary, backup/restore identifiers, and rollback criteria in the private deployment register.

Rollback application containers to the prior image only if the database migration remains compatible. Never run a destructive Alembic downgrade on production data; restore an isolated verified backup and plan a forward fix.
