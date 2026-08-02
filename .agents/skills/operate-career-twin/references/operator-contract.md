# Operator contract

Required production properties:

- `APP_ENV=production`, unique high-entropy application and CSRF secrets, `SECURE_COOKIES=true`.
- PostgreSQL URL using the SQLAlchemy PostgreSQL driver; Redis must be reachable.
- TLS termination with trusted proxy configuration and request-body limits.
- ClamAV must be configured; production uploads fail closed without it.
- Blob and connector encryption keys are unique, runtime-only, and included in private restore procedures. Private Docling must authenticate with a runtime-only API key.
- Hosted-provider keys are optional and environment-only. Production uses a real provider; Compose supplies private Ollama and mock/test modes are not valid runtime configurations.
- Production readiness includes the exact private Ollama chat/extraction model, local embedding model, Docling, ClamAV, PostgreSQL, and Redis.
- ARQ worker execution requires Redis. Queued agent runs persist checkpoint state and expose tenant-scoped poll, cancel, and retry operations.
- Langfuse is optional and receives only hashed subjects, input digests, counts, provider/specialist labels, attempt, and terminal status.
- Liveness: `/api/health/live`; dependency readiness: `/api/health/ready`; metrics: `/metrics`.
- Database migrations are controlled through Alembic. Never use destructive downgrades on production data.
- Superusers manage account lifecycle only and have no cross-account career-content browser.
- Release gates include the exact 10-seeker representative fixture and a serious/critical automated accessibility scan.
- Dataset imports retain ESCO/O*NET release provenance; semantic changes must pass the pinned retrieval benchmark before promotion.
