# ADR 0006: Deterministic, versioned matching with coverage

- Status: Accepted
- Date: 2026-08-01

## Decision

Matching is a pure versioned service over canonical inputs. Persist immutable results keyed by policy and input digest. Separate hard eligibility, weighted evidence alignment, coverage, and ignorance bounds. Withhold a scalar below minimum coverage. Never label output hiring probability.

## Consequences

Results are reproducible, testable, explainable, and honest about missing evidence. The policy is less adaptive than an opaque learned ranker; semantic retrieval may help candidate matching later but cannot replace published deterministic scoring without a new ADR and evaluation evidence.
