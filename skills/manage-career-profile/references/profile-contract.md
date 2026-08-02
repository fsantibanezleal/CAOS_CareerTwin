# Profile contract

- Read: `GET /api/profile`, `/api/profile/skills`, `/api/profile/experiences`, `/api/profile/education`, `/api/profile/claims`, `/api/profile/sources`, `/api/profile/graph`.
- Curate: `PUT /api/profile` with the current `revision`.
- Upload: `POST /api/profile/sources/upload` as multipart with `file` and optional `label`.
- Decide: `POST /api/profile/claims/{id}/decision` with `confirmed` or `rejected`.
- Add skill: `POST /api/profile/skills`; all supplied evidence IDs must be confirmed and tenant-owned.
- Add chronology: `POST /api/profile/experiences` or `/api/profile/education`.

All non-read requests require the browser session cookie and `X-CSRF-Token`. API docs are available at `/api/docs` on the running instance.
