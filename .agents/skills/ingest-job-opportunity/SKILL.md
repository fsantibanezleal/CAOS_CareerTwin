---
name: ingest-job-opportunity
description: Capture and normalize one job opportunity in CareerTwin from a public URL, supported document, pasted posting, or manual fields. Use when adding a role, reviewing extracted requirements, preserving deadlines and provenance, or deduplicating a saved posting. Never bypass site access controls or silently accept extracted requirements.
---

# Ingest Job Opportunity

Skill contract version: 1.2.0.

## Outcome

Create a reviewable, versioned opportunity snapshot with atomic requirements, provenance, dates, location, industry, seniority, and explicit eligibility conditions.

## Workflow

1. Read `Entry_point.md` and `references/opportunity-contract.md`.
2. Choose exactly one capture mode: public URL, file, paste/manual, or an explicit browser-extension capture of the visible page.
3. For URLs, capture only an unauthenticated public HTTP(S) page. Do not weaken SSRF checks, use local addresses, forward credentials, or scrape search result lists.
4. For documents and browser captures, keep content within upload limits and supported formats. The production scanner must pass before queued private Docling/model extraction. Poll its source state; never treat `pending` as completed.
5. Detect duplicates by the returned source snapshot/hash; do not create near-identical copies without the seeker's instruction.
6. Review the title, employer, full description, source, dates, location, remote mode, industry, area, seniority, compensation, and status.
7. Split the posting into atomic requirements. Mark each as eligibility, required, or preferred; choose a category and bounded weight. Preserve its source locator.
8. Save a reviewed version and inspect its immutable revision history when the source changed.
9. Add the opportunity to a named target portfolio only when the seeker wants it in that explicit comparison scenario. Explain that structured content is the seeker's research record, not a claim about the entire labor market.

## Guardrails

- Never log authenticated URLs, cookies, job-board credentials, or full private documents.
- Browser capture credentials are displayed once, revocable, and must never enter Git, shell history, screenshots, or issue text.
- Respect robots, terms, and access controls; this skill is for user-selected individual opportunities, not unrestricted crawling.
- Do not interpret employer language as objective truth.
- Keep discriminatory, protected-trait, and unrelated personal requirements out of scoring; flag them for human review.
- Do not apply, message, or submit data to an employer.

## Completion

Return the opportunity ID and version, capture provenance, requirement counts by importance/category, extracted dates, and every field still needing human review.
