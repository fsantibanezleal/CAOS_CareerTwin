# Product model

## Primary persona

One authenticated account represents one professional seeker and owns exactly one workspace/profile plus many sources, opportunities, match runs, artifacts, applications, conversations, and tasks. A superuser is also a normal seeker but gains account lifecycle operations; superuser status does not grant a content-browser API for other people.

## Modules

1. **Professional twin**: identity, narrative, preferences, links, skill evidence, experience, education, sources, GitHub snapshots, and visual projections.
2. **Evidence inbox**: proposed/confirmed/rejected claims with provenance and confidence.
3. **Opportunity research**: URL/file/paste/manual capture, reviewed metadata, atomic requirements, source hash, and version.
4. **Matching**: deterministic immutable runs with eligibility, alignment, coverage, uncertainty, category components, and an evidence bridge.
5. **Readiness**: gap-derived recommendations and user-selected tasks.
6. **Artifact studio**: versioned résumé, cover-letter, interview-brief, and follow-up drafts assembled from confirmed evidence.
7. **Pipeline**: legal stage transitions, immutable history, tasks, meetings, deadlines, calendar export, and denominator-aware personal analytics.
8. **Career copilot**: provider-selectable, evidence-cited conversations and previewed changes.
9. **Administration**: invite, disable/restore, session revocation, and explicit purge.

## Lifecycle

The normal path is source -> proposed claims -> human decision -> curated graph -> reviewed opportunity -> match run -> recommendations/artifact -> application pipeline -> retrospective evidence. The user can enter at any module; CareerTwin must reveal missing prerequisites rather than fabricate them.

## Explicit non-goals

- No automatic application, browser form filling, bulk outreach, or employer messaging.
- No global employer/candidate ranking, “hireability,” or predicted hiring outcome.
- No protected-trait inference or use in scoring.
- No unrestricted job-board crawling or access-control bypass.
- No silent model write to canonical data.
- No public profile sharing in the first alpha.

## Honest language

“Alignment” describes current confirmed evidence against user-reviewed requirements. “Coverage” describes how much can be resolved. “Unknown” is not weakness. Saved-opportunity analytics describe only the user's collection, and pipeline analytics describe only that person's process history.
