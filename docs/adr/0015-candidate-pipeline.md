# ADR 0015: Candidate-owned application state machine

- Status: Accepted
- Date: 2026-08-01

## Decision

Track one application per saved opportunity through explicit legal transitions. Append immutable stage events; attach contacts, tasks, meetings, deadlines, and reminders; exchange RFC 5545 calendar data. Optional consent-bound Google/Microsoft connectors synchronize a user-selected calendar window and read bounded recruiting-thread excerpts without mailbox write scope. ADR 0024 defines connector consent, encryption, retention, and browser-capture boundaries. Analytics include denominators and small-sample warnings.

## Consequences

The pipeline is an organizer, not an automation bot or employer CRM. Corrections use legal transitions/history rather than overwriting events. Terminal states are intentionally closed in v1; reopening requires a future rule and visible event.
