# CareerTwin entry point

Read this file before changing the repository.

## Product boundary

CareerTwin is the repository: evidence and opportunity domain modules, typed graph projections,
deterministic matching/recommendations, connectors, external-provider harness, native scripts,
versioned skills, tests, and documentation. The local and hosted web apps are two interfaces over
that product. A VPS is not an inference host.

The active architecture authority is
[`ADR 0026`](docs/adr/0026-native-first-external-api-repository-product.md): native-first local
operation, repo-root `.venv`, lockfile-installed Node dependencies, SQLite locally, PostgreSQL when
hosted, a database-backed worker, external AI APIs only, and Docker as optional packaging.

## Source of truth

- `docs/architecture/README.md`: architecture and data flow.
- `docs/adr/`: accepted architecture decision records.
- `docs/product/`: user workflows and domain semantics.
- `docs/runbooks/`: local and VPS operation.
- `backend/`: FastAPI application and deterministic domain services.
- `frontend/`: React workbench.
- `.agents/skills/`: auto-discovered, versioned repository-local Codex skills.
- `scripts/career.ps1` and `scripts/career.sh`: credential-safe local harness used by the skills.
- `tests/` and `evals/`: executable contracts.

## Non-negotiable boundaries

- One seeker workspace per account; all career content is tenant-scoped.
- No secrets, tokens, uploaded documents, exports, backups or personal records in Git.
- Model output never writes canonical data directly. Users preview and approve proposed changes.
- Matching is an explainable alignment score, never a hiring probability.
- Protected traits are neither inferred nor used for scoring.
- The GitHub connector is read-only and its user token is memory-only.
- AI inference is external-only; never add Ollama, local OCR/model services, embedded model downloads,
  or silent provider fallbacks.
- Native local use must work without Docker, Redis, or system-wide Python/Node packages.
- Python dependencies belong in repo-root `.venv`; frontend dependencies belong in ignored
  `frontend/node_modules` and come from `npm ci` plus the committed lockfile.
- There is no automatic job application, bulk outreach or unrestricted scraping.

## Native start

Run `scripts/setup.ps1`/`.sh`, bootstrap the first account through the hidden password prompt, then
run `scripts/dev.ps1`/`.sh`. Verify with `scripts/career.* doctor` and `scripts/verify.*`. Use
`-Docker`/`--docker` only when explicitly testing the optional packaging profile.

## Change path

Create or reference a GitHub issue, work on a focused branch, update tests and documentation, run
the repository verification scripts, then open a pull request against `develop`. Deploy only from a
reviewed and verified revision.
