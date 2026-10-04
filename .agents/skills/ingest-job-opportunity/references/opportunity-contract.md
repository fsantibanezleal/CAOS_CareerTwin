# Opportunity contract

## Native harness

- Search: `scripts/career.ps1 job-search --json-file <ignored-query.json>`.
  Query example: `{ "provider": "himalayas", "query": "data leadership", "country": "CL" }`.
  Jobicy example: `{ "provider": "jobicy", "query": "data", "geo": "latam" }`.
- Save exactly one preview: `scripts/career.ps1 job-import --preview-file <ignored-preview.json> --index 0`.
  This only saves a private reviewable snapshot; it neither applies nor approves requirements.

- Public URL: `scripts/career.ps1 opportunity-url https://example.com/job`.
- Document: `scripts/career.ps1 opportunity-file --file <path> [--title <title>] [--employer <name>]`.
- Read: `scripts/career.ps1 get /api/opportunities`.
- Graph: `scripts/career.ps1 opportunity-graph`.
- Curated mutation: `scripts/career.ps1 request PUT /api/opportunities/{id} --json-file <ignored-json-path>`.

Use the `.sh` wrapper on POSIX. The harness keeps the login cookie and CSRF token in memory and never accepts a password argument.

## API

- Discovery: `POST /api/job-search`; provider restrictions and continuation are strict.
- Source taxonomy: `GET /api/job-search/catalog`.
- Selected preview: `POST /api/job-search/import` with a workspace-bound `ticket`.
- Private queries: `GET/POST /api/job-search/presets`, `DELETE /api/job-search/presets/{id}`.
  Maximum 12 first-page presets, no automatic provider polling.

- List/read: `GET /api/opportunities` and `GET /api/opportunities/{id}`.
- Public URL: `POST /api/opportunities/capture-url` with `{ "url": "https://..." }`.
- Document: multipart `POST /api/opportunities/capture-file`.
- Browser capture: `POST /api/connectors/browser/capture`; manage one-time credentials at `/api/connectors/browser/credentials`.
- Manual/paste: `POST /api/opportunities` with `OpportunityCreate`.
- Re-extract without mutation: `POST /api/opportunities/{id}/propose-requirements`.
- Save reviewed revision: `PUT /api/opportunities/{id}`; read immutable revisions at `GET /api/opportunities/{id}/history`.
- Target sets: `GET/POST /api/opportunities/target-sets` and `PUT/DELETE /api/opportunities/target-sets/{id}`.
- Landscape: `GET /api/opportunities/visualization/landscape`.

File and browser captures are database-backed asynchronous work. Poll through `pending` and `processing`. The source hash and immutable opportunity version make later matching reproducible; every extracted requirement remains editable.
