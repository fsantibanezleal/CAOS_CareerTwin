# CareerTwin entry point

Read this file before changing the repository.

## Source of truth

- `docs/architecture/README.md`: architecture and data flow.
- `docs/adr/`: accepted architecture decision records.
- `docs/product/`: user workflows and domain semantics.
- `docs/operations/`: local and VPS operation.
- `backend/`: FastAPI application and deterministic domain services.
- `frontend/`: React workbench.
- `.agents/skills/`: auto-discovered, versioned repository-local Codex skills.
- `tests/` and `evals/`: executable contracts.

## Non-negotiable boundaries

- One seeker workspace per account; all career content is tenant-scoped.
- No secrets, tokens, uploaded documents, exports, backups or personal records in Git.
- Model output never writes canonical data directly. Users preview and approve proposed changes.
- Matching is an explainable alignment score, never a hiring probability.
- Protected traits are neither inferred nor used for scoring.
- The GitHub connector is read-only and its user token is memory-only.
- There is no automatic job application, bulk outreach or unrestricted scraping.

## Change path

Create or reference a GitHub issue, work on a focused branch, update tests and documentation, run
the repository verification scripts, then open a pull request against `develop`. Deploy only from a
reviewed and verified revision.
