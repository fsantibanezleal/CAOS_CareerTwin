# ADR 0021: Durable agent execution and redacted observability

- Status: Partially superseded by ADR 0026
- Date: 2026-08-02

## Context

Synchronous provider calls do not survive request interruption and cannot offer reliable cancellation, retry history, or operator-visible lifecycle state. Conventional LLM telemetry often captures prompts and outputs, which is incompatible with a private professional evidence workspace.

## Decision

Persist the visible message and queued `AgentRun` in PostgreSQL before submitting its ID to Redis/ARQ. Workers reapply tenant context and reconstruct bounded context from that visible message, confirmed claims and an optional latest match. A run commits before provider execution and at a terminal completed, failed or cancelled boundary. Cancellation is observed before and after provider work. Retry creates a child attempt with a parent ID and never edits the prior run.

Keep synchronous chat for bounded compatibility, but expose queue, list, poll, cancel and retry APIs and use the durable path in the web drawer. Optional Langfuse v4 observations use a deliberately redacted contract: hashed run/subject identifiers, input digest, counts, provider/specialist labels, attempt and status only. Telemetry failure is non-fatal.

## Consequences

Agent work is recoverable and inspectable without storing hidden reasoning. Provider calls already in progress may finish after cancellation, but their answer is discarded at the next checkpoint. Redis remains non-canonical; PostgreSQL determines lifecycle truth. Operators gain less model-debug detail from telemetry and must reproduce quality issues with consented synthetic fixtures.
