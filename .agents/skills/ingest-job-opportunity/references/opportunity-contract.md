# Opportunity contract

## Native harness

- Public URL: `scripts/career.ps1 opportunity-url https://example.com/job`.
- Document: `scripts/career.ps1 opportunity-file --file <path> [--title <title>] [--employer <name>]`.
- Read: `scripts/career.ps1 get /api/opportunities`.
- Graph: `scripts/career.ps1 opportunity-graph`.
- Curated mutation: `scripts/career.ps1 request PUT /api/opportunities/{id} --json-file <ignored-json-path>`.

Use the `.sh` wrapper on POSIX. The harness keeps the login cookie and CSRF token in memory and never accepts a password argument.

## API

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
