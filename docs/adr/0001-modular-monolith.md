# ADR 0001: Modular monolith with worker seam

- Status: Accepted
- Date: 2026-08-01

## Context

CareerTwin needs transactional relationships across evidence, opportunities, matches, artifacts, and a personal pipeline, while remaining easy to self-host and contribute to.

## Decision

Use one FastAPI/SQLAlchemy application organized into domain routers/services plus a separate ARQ worker using the same package. The React client is independently built and served by the application in production.

## Consequences

Transactions, migrations, authorization, and local setup remain legible. Slow work has a queue seam without premature distributed services. Scaling components independently is deferred; domain boundaries and event/audit records preserve an extraction path.
