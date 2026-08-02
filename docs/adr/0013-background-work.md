# ADR 0013: Redis and ARQ for background work

- Status: Accepted
- Date: 2026-08-01

## Decision

Use Redis-backed ARQ for resumable encrypted-source processing, typed model extraction, durable agent runs, email retention, and reminders. Worker jobs carry explicit workspace/resource IDs, reapply tenant context, are bounded/idempotent, and store user-visible state in PostgreSQL. User-triggered calendar and email synchronization executes synchronously within strict provider time and item bounds; imported state and idempotency keys remain canonical in PostgreSQL.

## Consequences

Slow work survives request timeouts and can be monitored. Redis is operational state, not canonical data. At-least-once execution means side effects require idempotency keys and duplicate checks. Agent cancel, retry, and worker phase transitions acquire a PostgreSQL row lock before changing a checkpoint. This prevents a queued-to-running worker commit from overwriting a concurrent browser cancellation and preserves a cancelled checkpoint as a valid retry parent.
