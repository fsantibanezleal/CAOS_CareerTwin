# ADR 0015: Candidate-owned application state machine

- Status: Accepted
- Date: 2026-08-01

## Decision

Track one application per saved opportunity through explicit legal transitions. Append immutable stage events; attach tasks/meetings/deadlines/reminders; export RFC 5545 calendar data. Analytics include denominators and small-sample warnings.

## Consequences

The pipeline is an organizer, not an automation bot or employer CRM. Corrections use legal transitions/history rather than overwriting events. Terminal states are intentionally closed in v1; reopening requires a future rule and visible event.
