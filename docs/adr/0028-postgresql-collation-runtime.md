# ADR 0028: Match the PostgreSQL runtime libc to persisted collation provenance

Status: accepted in 0.4.1.

## Context

PostgreSQL records a provider-specific version for each database's default collation. The hosted
CareerTwin cluster was initialized under glibc 2.36 and therefore records version `2.36`. Running
that volume with an Alpine/musl PostgreSQL image makes
`pg_database_collation_actual_version()` return `NULL`; PostgreSQL cannot validate the recorded
provenance and warns on every connection.

The warning is not safely resolved by editing `pg_database.datcollversion`, suppressing logs, or
declaring a refresh. Those approaches erase evidence without demonstrating that persisted indexes
and the runtime use compatible collation behavior. PostgreSQL's supported refresh operation also
rejects a transition between a known version and `NULL`.

## Decision

The hosted database image uses the immutable multi-platform digest for PostgreSQL 17.10 Bookworm,
whose glibc runtime can resolve and compare the cluster's `en_US.utf8` collation version. pgvector
remains compiled from its exact commit and verified source checksum in a multi-stage build. Build
dependencies do not enter the runtime image.

A database-image change is releasable only after an isolated restore of an owner-only production
backup proves all of the following:

- the dump restores without application data loss;
- the migration revision remains at head;
- pgvector loads at the expected version;
- recorded and actual database collation versions are equal and non-null; and
- no direct system-catalog mutation is needed.

## Consequences

- The database image is larger than Alpine, but it restores meaningful collation-version checks and
  uses the libc family under which the persistent cluster was created.
- Base-image changes must preserve both PostgreSQL major-version compatibility and libc collation
  provenance; a smaller image is not automatically a safer image for a persistent database.
- A future intentional libc or locale upgrade requires backup, affected-index analysis/rebuild, and
  PostgreSQL's documented collation refresh workflow rather than a silent image swap.
