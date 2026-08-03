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

The hosted database image uses an immutable multi-platform Wolfi base digest plus exact PostgreSQL
17.10 package versions. Its glibc runtime can resolve and compare the cluster's `en_US.utf8`
collation version without reintroducing the high-severity findings in the Debian runtime variants.
pgvector remains compiled from its exact commit and verified source checksum in a multi-stage build;
the compiler and headers do not enter the runtime image. The PostgreSQL server, client, contrib, and
OCI entrypoint packages are all version-pinned so the deployment contract remains on major 17.

When the resolved glibc collation version changes, the deployment enters a maintenance gate: keep a
verified recovery backup, stop application writers, rebuild the database's collation-dependent
indexes with `REINDEX DATABASE`, run `ALTER DATABASE ... REFRESH COLLATION VERSION`, and prove the
recorded/actual versions agree before restarting the app and worker. This is not a schema migration
because it is runtime- and database-cluster-specific maintenance.

A database-image change is releasable only after an isolated restore of an owner-only production
backup proves all of the following:

- the dump restores without application data loss;
- the migration revision remains at head;
- pgvector loads at the expected version;
- recorded and actual database collation versions are equal and non-null; and
- no direct system-catalog mutation is needed.

## Consequences

- The database image is larger than Alpine, but it restores meaningful collation-version checks,
  stays on the libc family under which the persistent cluster was created, and passes the same
  high-severity scanner gate enforced in CI.
- Base-image changes must preserve both PostgreSQL major-version compatibility and libc collation
  provenance; a smaller image is not automatically a safer image for a persistent database.
- A future intentional libc or locale upgrade requires backup, affected-index analysis/rebuild, and
  PostgreSQL's documented collation refresh workflow rather than a silent image swap.
