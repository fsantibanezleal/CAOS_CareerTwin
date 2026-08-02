# Pipeline contract

- Applications: `GET/POST /api/pipeline/applications`, `POST /api/pipeline/applications/{id}/stage`, and `GET /api/pipeline/applications/{id}/history`.
- Contacts: `GET/POST /api/pipeline/contacts`, `PUT/DELETE /api/pipeline/contacts/{id}`.
- Agenda: `GET/POST /api/pipeline/tasks` and `POST /api/pipeline/tasks/{id}/complete`.
- Calendar: `GET /api/pipeline/calendar.ics` and multipart `POST /api/pipeline/calendar/import` with `file`.
- Connector status/start/callback/disconnect: `GET /api/connectors`, `/api/connectors/oauth/{provider}/start`, `/api/connectors/oauth/callback`, and `DELETE /api/connectors/{id}`.
- Explicit synchronization: `POST /api/connectors/{id}/calendar/sync` and `POST /api/connectors/{id}/email/sync`; list retained excerpts at `GET /api/connectors/email/threads`.
- Signals: `GET /api/pipeline/analytics`.

Application and contact identifiers must belong to the current tenant. A task contact must be unassigned or linked to the same application. Calendar imports are bounded to 1 MiB and 1,000 events and skip an already imported UID. OAuth synchronization is user-triggered, window/item bounded, and available only when an operator configured that provider. Email is read-only and excerpt retention is finite. All non-read requests require the session cookie and `X-CSRF-Token`.
