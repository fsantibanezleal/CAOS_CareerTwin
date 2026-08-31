# ADR 0022: Representative-volume and accessibility release gates

- Status: Accepted
- Date: 2026-08-02

## Context

Unit coverage and a successful bundle do not show that the one-seeker workbench remains usable with realistic saved-job/source volumes or that the login boundary avoids automatically detectable severe accessibility failures.

## Decision

Run a fixed synthetic fixture in local verification and CI: 10 users, each with 100 opportunities, 50 documents and 50 repository snapshots. Verify exact tenant-separated cardinalities and time 50 authenticated dashboard, opportunity, landscape, graph and portfolio reads. Fail when p95 exceeds 2.5 seconds. The script always creates and disposes an ephemeral database so it cannot load personal or production data.

Run axe-core against the invite-only login surface and fail on serious or critical violations. Retain semantic labels, keyboard-capable controls, nonvisual graph/table equivalents, reduced-motion styles, ESLint, TypeScript and production bundle gates. Automated accessibility is a floor; rendered keyboard, contrast, zoom, screen-reader and phone-scale review remains a release responsibility.

## Consequences

Regressions in common read paths and severe static accessibility rules become release-blocking and reproducible. SQLite timing is a stable local smoke threshold, not a VPS capacity claim; PostgreSQL migration/integration and live smoke checks remain separate gates. Manual visual/assistive-technology review cannot be replaced by axe.
