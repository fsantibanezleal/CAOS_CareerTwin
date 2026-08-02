# ADR 0020: Portable profile contracts and explicit target portfolios

- Status: Accepted
- Date: 2026-08-02

## Context

A user-controlled career system must not trap the professional graph in internal row identifiers. A single global score across every saved job also hides which opportunities the seeker actually wants to compare. Opportunity edits need historical provenance rather than a mutable version counter alone.

## Decision

Provide a versioned CareerTwin profile interchange document that preserves profile fields, safe source metadata, claims, evidence links, skills, experience and education while excluding uploaded bytes, storage keys and extracted text. Provide JSON Resume import/export with a namespaced lossless CareerTwin extension. Imports are tenant-scoped, validate bounded collections, replace only the current profile domain, and remap all identifiers.

Persist an immutable opportunity snapshot for every reviewed version. Let the seeker create named target portfolios containing tenant-owned opportunity IDs and explicit scenario weights. Compute portfolio alignment and shared-gap actions only from the latest immutable match for each member, publishing the denominator and coverage.

## Consequences

Seekers can leave, restore and exchange data without leaking private blobs. Re-import changes internal IDs by design, so external consumers must not depend on database identifiers. Named scenarios make aggregate scores interpretable but require the user to curate membership and weights. Snapshots consume additional storage and are deleted only with their opportunity/account lifecycle.
