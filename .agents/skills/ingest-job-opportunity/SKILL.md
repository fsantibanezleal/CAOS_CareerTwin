---
name: ingest-job-opportunity
description: Search documented public job sources, then capture and normalize one selected opportunity in CareerTwin from a search preview, public URL, supported document, pasted posting, or manual fields. Use when researching roles through the native harness or web UI, reviewing extracted requirements, preserving deadlines and provenance, deduplicating a posting, or adding it to a target set. Never bypass site controls or silently accept extracted requirements.
---

# Ingest Job Opportunity

Skill contract version: 2.2.0.

## Outcome

Create a reviewable, versioned opportunity snapshot with atomic requirements, provenance, dates, location, industry, seniority, and explicit eligibility conditions.

## Workflow

1. Read `Entry_point.md` and `references/opportunity-contract.md`; verify the native instance with `scripts/career.* doctor`.
2. Choose one capture mode: public URL, file, manual/paste, or explicit browser-extension capture of the visible page.
   For combined discovery, run `job-battery --json-file <ignored-battery.json>`; single-source
   discovery remains `job-search --json-file <ignored-query.json>`. Inspect independent coverage,
   failures and the attributed
   preview before `job-import --preview-file <ignored-preview.json> --index <zero-based-index>`.
   Only explicit search terms leave the app. Remote sources do not cover the whole local market.
   Preserve country/timezone restrictions and salary units. An empty result is not a hiring verdict.
   Read `docs/runbooks/job-discovery.md` for battery bounds and continuation. External research
   links are manual research, not API coverage. Saved batteries never poll automatically.
3. Use `scripts/career.ps1 opportunity-url <https-url>` or `opportunity-file --file <path>` (use `.sh` on POSIX). Use a bounded ignored JSON body plus `request POST /api/opportunities` for manual capture.
4. For URLs, capture only a user-selected unauthenticated public HTTP(S) page. Never weaken SSRF checks, use local addresses, forward credentials, or crawl result lists.
5. Poll the returned capture/source through `pending` and `processing` until ready. Supported text extraction runs natively; configured external xAI document understanding is used only when an image or scanned PDF needs it. No local model service is involved.
6. Review title, employer, description, source, dates, location, remote mode, industry, area, seniority, compensation, and status.
7. Split the posting into atomic requirements. Mark each as eligibility, required, or preferred; choose category and bounded weight; preserve its locator. Save a reviewed version rather than silently accepting extraction.
8. Inspect immutable history when a source changes. Add the role to a named target set only when the seeker wants it in that scenario.
   For a worthwhile career move, read `docs/runbooks/career-strategy.md` and the seeker's full
   evidence. Verify actual authority, active requisition and compatible employer compensation.
   Unknown pay remains unknown; market benchmarks never become actual offers or approved moves.
9. Run `scripts/career.* opportunity-graph` to inspect the typed role/employer/requirement network. Use the web graph for its interactive network, adjacency matrix, table, facets, and node inspector.

## Guardrails

- Never log authenticated URLs, cookies, job-board credentials, or full private documents.
- Browser capture credentials are shown once and revocable; never put them in Git, command history, screenshots, or issues.
- Respect terms, robots, and access controls. This workflow captures individual opportunities selected by the user; it is not unrestricted scraping.
- Exclude protected-trait or unrelated personal requirements from scoring and flag them for review.
- Never apply, message, or submit data to an employer.
- Preview references expire after 15 minutes and bind to the authenticated workspace. Rerun a
  search after expiry or server restart. Save no preview, private query or import ticket in Git.
- Named queries are private preferences, not background alerts. Read source documentation and
  restrictions before use; a source expiry is not a confirmed application deadline.

## Completion

Return opportunity ID and version, provenance, requirement counts by importance/category, extracted dates, duplicate state, and every field still requiring review.
