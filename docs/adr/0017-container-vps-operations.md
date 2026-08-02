# ADR 0017: Compose-first VPS persistence and verified restoration

- Status: Accepted
- Date: 2026-08-01

## Decision

Ship a multi-stage image and Compose topology with migration, app, worker, PostgreSQL/pgvector, Redis, ClamAV, and persistent DB/blob/queue/scanner volumes. Production adds TLS/secret injection and encrypted off-host backups. A backup is not verified until an isolated restore test passes.

## Consequences

Local and VPS topology remain similar, restarts preserve state, and migrations precede app/worker. Operators own capacity, proxy, monitoring, and backup schedules. Application rollback cannot destructively downgrade the database.
