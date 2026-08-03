# Product model

## Primary persona

One authenticated account represents one professional seeker and owns exactly one workspace/profile plus many sources, opportunities, match runs, artifacts, applications, conversations, and tasks. A superuser is also a normal seeker but gains account lifecycle operations; superuser status does not grant a content-browser API for other people.

## Modules

1. **Professional twin**: identity, narrative, preferences, links, skill evidence, experience, education, sources, GitHub snapshots, lossless/JSON Resume exchange, and visual projections.
2. **Evidence inbox**: proposed/confirmed/rejected claims with provenance and confidence.
3. **Opportunity research**: URL/file/paste/manual capture, reviewed metadata, atomic requirements, source hash, immutable revisions, named target portfolios, and a typed opportunity knowledge graph.
4. **Matching**: deterministic immutable runs with eligibility, alignment, coverage, uncertainty, category components, an evidence bridge, and explicit portfolio scenarios.
5. **Readiness**: gap-derived editable learning/action plans, shared-gap matrices, and user-selected tasks.
6. **Artifact studio**: versioned résumé, cover-letter, interview-brief, and follow-up drafts assembled from confirmed evidence.
7. **Pipeline**: legal stage transitions, immutable history, contacts, tasks, meetings, deadlines, UID-idempotent file/calendar synchronization, read-only recruiting-thread context, and denominator-aware personal analytics.
8. **Career artifacts**: evidence-backed STAR stories, immutable tailored résumé versions, cover letters, interview briefs, and follow-ups.
9. **Personal connectors**: request-memory-only GitHub review, consent-bound Google/Microsoft calendar/email, and explicit browser opportunity capture.
10. **Career copilot**: managed-provider-selectable, evidence-cited conversations, durable database-backed cancel/retry execution, previewed changes, and browser-to-xAI Grok Voice with an ephemeral credential.
11. **Administration**: invite, disable/restore, session revocation, and explicit purge.

## Lifecycle

The normal path is source → proposed claims → human decision → curated graph → reviewed opportunity/snapshot → named target portfolio → match run → editable recommendation/artifact → application/contact/agenda pipeline → retrospective evidence. The user can enter at any module; CareerTwin must reveal missing prerequisites rather than fabricate them.

## Explicit non-goals

- No automatic application, browser form filling, bulk outreach, or employer messaging.
- No global employer/candidate ranking, “hireability,” or predicted hiring outcome.
- No protected-trait inference or use in scoring.
- No unrestricted job-board crawling or access-control bypass.
- No silent model write to canonical data.
- No local/VPS model inference, OCR model, embedding server, or undisclosed provider fallback.
- No public profile sharing; the product remains a private, candidate-controlled workspace.

## Honest language

“Alignment” describes current confirmed evidence against user-reviewed requirements. “Coverage” describes how much can be resolved. “Unknown” is not weakness. A target-portfolio score describes only its named saved-role scenario. Pipeline analytics describe only that person's process history.
