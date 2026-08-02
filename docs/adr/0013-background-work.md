# ADR 0013: Redis and ARQ for background work

- Status: Accepted
- Date: 2026-08-01

## Decision

Use Redis-backed ARQ for resumable source processing, retention, reminders, and future connector/provider jobs. Worker jobs carry explicit workspace/source IDs, reapply tenant context, are bounded/idempotent, and store user-visible state in PostgreSQL.

## Consequences

Slow work survives request timeouts and can be monitored. Redis is operational state, not canonical data. At-least-once execution means side effects require idempotency keys and duplicate checks.
