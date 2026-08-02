# Pipeline contract

- Applications: `GET/POST /api/pipeline/applications`, `POST /api/pipeline/applications/{id}/stage`, and `GET /api/pipeline/applications/{id}/history`.
- Contacts: `GET/POST /api/pipeline/contacts`, `PUT/DELETE /api/pipeline/contacts/{id}`.
- Agenda: `GET/POST /api/pipeline/tasks` and `POST /api/pipeline/tasks/{id}/complete`.
- Calendar: `GET /api/pipeline/calendar.ics` and multipart `POST /api/pipeline/calendar/import` with `file`.
- Signals: `GET /api/pipeline/analytics`.

Application and contact identifiers must belong to the current tenant. A task contact must be unassigned or linked to the same application. Calendar imports are bounded to 1 MiB and 1,000 events and skip an already imported UID. All non-read requests require the session cookie and `X-CSRF-Token`.
