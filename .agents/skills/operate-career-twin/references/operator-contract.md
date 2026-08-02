# Operator contract

Required production properties:

- `APP_ENV=production`, unique high-entropy application and CSRF secrets, `SECURE_COOKIES=true`.
- PostgreSQL URL using the SQLAlchemy PostgreSQL driver; Redis must be reachable.
- TLS termination with trusted proxy configuration and request-body limits.
- ClamAV must be configured; production uploads fail closed without it.
- Provider keys are optional and environment-only. `mock` remains available for safe verification.
- ARQ worker execution requires Redis. Queued agent runs persist checkpoint state and expose tenant-scoped poll, cancel, and retry operations.
- Langfuse is optional and receives only hashed subjects, input digests, counts, provider/specialist labels, attempt, and terminal status.
- Liveness: `/api/health/live`; dependency readiness: `/api/health/ready`; metrics: `/metrics`.
- Database migrations are controlled through Alembic. Never use destructive downgrades on production data.
- Superusers manage account lifecycle only and have no cross-account career-content browser.
- Release gates include the exact 10-seeker representative fixture and a serious/critical automated accessibility scan.
