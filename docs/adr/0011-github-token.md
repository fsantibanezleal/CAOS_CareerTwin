# ADR 0011: GitHub tokens are one-request, read-only, and memory-only

- Status: Accepted
- Date: 2026-08-01

## Decision

The seeker supplies a fine-grained read-only PAT in a POST body for one connector call. The server sends it only in the GitHub authorization header, never logs/persists/returns it, and persists a bounded snapshot and proposed claims for at most 50 repositories.

## Consequences

No refresh token or background synchronization exists; users reauthorize intentionally. Repository metadata can support claims but never establishes mastery. A future GitHub App/OAuth flow needs a new credential-storage ADR.
