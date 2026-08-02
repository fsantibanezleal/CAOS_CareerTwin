# Profile contract

- Read: `GET /api/profile`, `/api/profile/skills`, `/api/profile/experiences`, `/api/profile/education`, `/api/profile/claims`, `/api/profile/sources`, `/api/profile/graph`.
- Curate: `PUT /api/profile` with the current `revision`.
- Upload: `POST /api/profile/sources/upload` as multipart with `file` and optional `label`.
- Decide: `POST /api/profile/claims/{id}/decision` with `confirmed` or `rejected`.
- Add skill: `POST /api/profile/skills`; all supplied evidence IDs must be confirmed and tenant-owned.
- Add chronology: `POST /api/profile/experiences` or `/api/profile/education`.
- Lossless portability: `GET /api/profile/interchange` and `POST /api/profile/interchange/import`.
- JSON Resume exchange: `GET /api/profile/json-resume` and `POST /api/profile/json-resume/import`.

Imports replace only the current tenant's professional-profile domain and remap source/evidence identifiers. Exports omit blob paths, uploaded bytes, and extracted private text. All non-read requests require the browser session cookie and `X-CSRF-Token`. API docs are available at `/api/docs` on the running instance.
