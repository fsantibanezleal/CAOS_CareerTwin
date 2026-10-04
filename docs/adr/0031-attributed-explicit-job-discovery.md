# 0031: Attributed explicit job discovery

Status: accepted, 2026-10-03

## Context

Seekers need to discover opportunities without exposing their profile or pretending that a remote
feed covers the complete local market. Source shapes and documented shapes differ, so adapters must
be validated against both. Automatic applications and unrestricted scraping are out of scope.

## Decision

Use documented public Himalayas and Jobicy APIs through fixed-host bounded IP-pinned HTTPS.
Normalize untrusted provider markup into plain text and preserve source links, geography, timezones,
salary units and UTC dates. Cache public pages, never workspace import authorization. Sign short-lived
preview references bound to a workspace, and save only explicit selections to tenant-owned immutable
opportunity snapshots. Requirements remain reviewable; source expiry is not an application deadline.

Private named searches live in profile preferences, capped at 12 first-page queries. Neither saving
nor opening a query triggers polling. The UI and native harness expose the same API contracts.
No secret-bearing provider connector, new worker service, local model or schema change is introduced.

## Consequences

Attribution and provenance survive import. Duplicate source URLs reuse the current seeker's role,
and cross-workspace references fail closed. Provider outages, rate limits, schema drift and expired
previews are explicit actionable errors. Source ranking is not deterministic evidence alignment.
Remote-feed coverage is limited; local-market research still needs lawful employer/board capture.

Acceptance includes tenant/CSRF/ticket/normalization/fetch/cache tests, UI actions, translations,
native harness, real provider probes, final-image scan and live viewport checks. Release
verification follows [the operational procedure](../runbooks/release-verification.md).
