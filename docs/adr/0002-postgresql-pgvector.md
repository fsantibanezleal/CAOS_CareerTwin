# ADR 0002: PostgreSQL and pgvector as canonical persistence

- Status: Accepted
- Date: 2026-08-01

## Decision

Use PostgreSQL 17 with pgvector in production. Relational rows are canonical; vectors are derived, model-versioned retrieval aids. SQLite is allowed only for local development and isolated tests.

## Consequences

One transactional store supports constraints, JSON, RLS, search, and optional embeddings. Operators must back up PostgreSQL and tune/index vectors from measured workloads. The system cannot claim production equivalence from SQLite tests alone.
