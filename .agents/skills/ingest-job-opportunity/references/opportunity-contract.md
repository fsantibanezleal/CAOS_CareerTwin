# Opportunity contract

- List/read: `GET /api/opportunities` and `GET /api/opportunities/{id}`.
- Public URL: `POST /api/opportunities/capture-url` with `{ "url": "https://..." }`.
- Document: `POST /api/opportunities/capture-file` as multipart.
- Browser capture: `POST /api/connectors/browser/capture` with its one-time bearer credential; manage credentials through `/api/connectors/browser/credentials`.
- Manual/paste: `POST /api/opportunities` with an `OpportunityCreate` body.
- Re-extract without mutation: `POST /api/opportunities/{id}/propose-requirements`.
- Save reviewed revision: `PUT /api/opportunities/{id}`.
- Immutable revisions: `GET /api/opportunities/{id}/history`.
- Named portfolios: `GET/POST /api/opportunities/target-sets` and `PUT/DELETE /api/opportunities/target-sets/{id}`.
- Personal landscape: `GET /api/opportunities/visualization/landscape`.

File and browser captures are queued outside tests and return an opportunity whose structured capture state is initially pending. Every captured requirement remains editable. The source hash and opportunity version make later scoring reproducible.
