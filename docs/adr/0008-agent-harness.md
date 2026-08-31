# ADR 0008: Bounded LangGraph and Pydantic AI harness

- Status: Accepted
- Date: 2026-08-01

## Decision

Use LangGraph for explicit routing/state and Pydantic contracts/providers for structured output. A provider receives bounded confirmed evidence. An evidence critic validates citations. Agent writes become previewed operations; an allowlisted deterministic service applies only approved changes.

## Consequences

The same harness supports offline tests and multiple providers without making model output authoritative. Durable `AgentRun` state supports recovery/observability. Full checkpoint/resume for every turn remains incremental; long external actions must be idempotent worker tasks.
