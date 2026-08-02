# ADR 0005: Atomic evidence claims require human decisions

- Status: Accepted
- Date: 2026-08-01

## Decision

Documents, GitHub, and agents create atomic proposed claims with source, locator, normalized value, and confidence. Only the seeker can confirm/reject a proposal. Canonical skills and match inputs use confirmed evidence; model output never promotes itself.

## Consequences

The profile can show provenance and disagreement, and prompt injection cannot directly rewrite it. Review creates user effort, so the UI provides an evidence inbox and batch-oriented visibility. “Proposed” must never be rendered as fact.
