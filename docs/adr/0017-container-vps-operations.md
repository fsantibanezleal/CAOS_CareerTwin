# ADR 0017: Compose-first VPS persistence and verified restoration

- Status: Accepted
- Date: 2026-08-01

## Decision

Ship a multi-stage image with digest-pinned Node and minimal Alpine Python bases, plus a Compose topology with digest-pinned PostgreSQL/pgvector, Redis, and ClamAV services and persistent DB/blob/queue/scanner volumes. The app port binds to loopback so only the TLS reverse proxy is public. Production adds secret injection and encrypted off-host backups. A backup is not verified until an isolated restore test passes. CI rejects high or critical findings in the complete runtime image and publishes an SBOM.

## Consequences

Local and VPS topology remain similar, restarts preserve state, and migrations precede app/worker. Operators own capacity, proxy, monitoring, and backup schedules. Application rollback cannot destructively downgrade the database.
