# API surface

The authoritative machine-readable contract is `/api/openapi.json`; interactive docs are at `/api/docs`.

| Area | Prefix | Purpose |
|---|---|---|
| Authentication | `/api/auth` | login, current user, logout, password change |
| Administration | `/api/admin` | account metadata and lifecycle only |
| Profile/evidence | `/api/profile` | canonical profile, skills, chronology, sources, decisions, graph, CareerTwin/JSON Resume exchange |
| Opportunities | `/api/opportunities` | capture, edit, immutable revisions, requirements, target portfolios, landscape |
| Matching/readiness | `/api/matches` | immutable runs, named/global alignment, shared-gap matrix, editable recommendations |
| Artifacts | `/api/artifacts` | evidence-grounded drafts, STAR accomplishments, immutable résumé variants |
| Pipeline | `/api/pipeline` | application stages/history, contacts, tasks, calendar import/export, analytics |
| Connectors | `/api/connectors` | bounded GitHub snapshot, OAuth grants, calendar/email sync, browser credential/capture |
| Agent | `/api/agent` | providers, prompt/schema manifest, chat, durable queue/poll/cancel/retry, redacted trace, conversations, proposed-change decisions |
| Taxonomy | `/api/taxonomy` | local ESCO/O*NET counts, checksum provenance, and lexical/graph/hybrid search |
| Workspace | `/api/workspace` | Today summary and portable export |
| Operations | `/api/health/*`, `/metrics` | liveness, dependency readiness (database, Redis, model, ClamAV, Docling), Prometheus |

## Browser contract

Login sets an HttpOnly opaque session cookie and a readable CSRF cookie. Every mutating request must include the CSRF value in `X-CSRF-Token`; requests include credentials. Production cookies are secure and same-site lax. CORS uses an explicit allowlist.

## Errors and privacy

Errors are bounded and sanitized. Connector/provider errors report class/category without credentials or upstream response bodies. Source list/profile interchange excludes storage keys, uploaded bytes and extracted document contents. Full data export is CSRF-protected and returned as a private ZIP. Durable-run reads expose visible checkpoints, digests, counts and error classes—never prompts, evidence bodies, outputs or hidden reasoning.
