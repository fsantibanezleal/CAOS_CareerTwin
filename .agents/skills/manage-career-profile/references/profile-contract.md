# Profile contract

## Native harness

- Check runtime: `scripts/career.ps1 doctor` or `scripts/career.sh doctor`.
- Read profile graph: `scripts/career.ps1 profile-graph`.
- Stage a source: `scripts/career.ps1 profile-upload --file <path> [--label <label>]`.
- Decide a claim: `scripts/career.ps1 claim-decision <claim-id> confirmed|rejected`.
- Read any resource: `scripts/career.ps1 get /api/profile/sources`.
- Send a curated JSON body: `scripts/career.ps1 request POST /api/profile/skills --json-file <ignored-json-path>`.

The harness authenticates with a hidden password prompt by default. `CAREERTWIN_LOCAL_URL`, `CAREERTWIN_LOCAL_EMAIL`, and process-only `CAREERTWIN_LOCAL_PASSWORD` are supported for automation. Never put the password in a command argument.

## API

- Read: `GET /api/profile`, `/api/profile/skills`, `/api/profile/experiences`, `/api/profile/education`, `/api/profile/claims`, `/api/profile/sources`, and `/api/profile/graph`.
- Curate: `PUT /api/profile` with the current `revision`.
- Upload: multipart `POST /api/profile/sources/upload` with `file` and optional `label`.
- Decide: `POST /api/profile/claims/{id}/decision` with `confirmed` or `rejected`.
- Add skill or chronology: `POST /api/profile/skills`, `/api/profile/experiences`, or `/api/profile/education`.
- Portability: `GET /api/profile/interchange`, `POST /api/profile/interchange/import`, `GET /api/profile/json-resume`, and `POST /api/profile/json-resume/import`.
- Artifacts: `GET/POST /api/artifacts/accomplishments`, `GET/POST /api/artifacts/resume-variants`, and `GET /api/artifacts/resume-variants/{id}`.

Uploaded sources are durable jobs: poll through `pending` and `processing` until `ready` or `failed`. Native text extraction is deterministic; a configured external provider may add typed quotation-supported proposals. Imports replace only the current tenant's professional-profile domain. Exports omit uploaded bytes, blob paths, and extracted private text.
