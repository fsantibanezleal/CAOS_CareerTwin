---
name: ingest-job-opportunity
description: Capture and normalize one job opportunity in CareerTwin from a public URL, supported document, pasted posting, or manual fields. Use when adding a role through the native harness or web UI, reviewing extracted requirements, preserving deadlines and provenance, deduplicating a posting, or adding it to a target set. Never bypass site controls or silently accept extracted requirements.
---

# Ingest Job Opportunity

Skill contract version: 2.0.0.

## Outcome

Create a reviewable, versioned opportunity snapshot with atomic requirements, provenance, dates, location, industry, seniority, and explicit eligibility conditions.

## Workflow

1. Read `Entry_point.md` and `references/opportunity-contract.md`; verify the native instance with `scripts/career.* doctor`.
2. Choose one capture mode: public URL, file, manual/paste, or explicit browser-extension capture of the visible page.
3. Use `scripts/career.ps1 opportunity-url <https-url>` or `opportunity-file --file <path>` (use `.sh` on POSIX). Use a bounded ignored JSON body plus `request POST /api/opportunities` for manual capture.
4. For URLs, capture only a user-selected unauthenticated public HTTP(S) page. Never weaken SSRF checks, use local addresses, forward credentials, or crawl result lists.
5. Poll the returned capture/source through `pending` and `processing` until ready. Supported text extraction runs natively; configured external xAI document understanding is used only when an image or scanned PDF needs it. No local model service is involved.
6. Review title, employer, description, source, dates, location, remote mode, industry, area, seniority, compensation, and status.
7. Split the posting into atomic requirements. Mark each as eligibility, required, or preferred; choose category and bounded weight; preserve its locator. Save a reviewed version rather than silently accepting extraction.
8. Inspect immutable history when a source changes. Add the role to a named target set only when the seeker wants it in that scenario.
9. Run `scripts/career.* opportunity-graph` to inspect the typed role/employer/requirement network. Use the web graph for its interactive network, adjacency matrix, table, facets, and node inspector.

## Guardrails

- Never log authenticated URLs, cookies, job-board credentials, or full private documents.
- Browser capture credentials are shown once and revocable; never put them in Git, command history, screenshots, or issues.
- Respect terms, robots, and access controls. This workflow captures individual opportunities selected by the user; it is not unrestricted scraping.
- Exclude protected-trait or unrelated personal requirements from scoring and flag them for review.
- Never apply, message, or submit data to an employer.

## Completion

Return opportunity ID and version, provenance, requirement counts by importance/category, extracted dates, duplicate state, and every field still requiring review.
