# API surface

The authoritative machine-readable contract is `/api/openapi.json`; interactive docs are at `/api/docs`.

| Area | Prefix | Purpose |
|---|---|---|
| Authentication | `/api/auth` | login, current user, logout, password change |
| Administration | `/api/admin` | account metadata and lifecycle only |
| Profile/evidence | `/api/profile` | canonical profile, skills, chronology, sources, decisions, graph |
| Opportunities | `/api/opportunities` | capture, edit, requirements, landscape |
| Matching/readiness | `/api/matches` | immutable runs, aggregate alignment, recommendations |
| Artifacts | `/api/artifacts` | evidence-grounded draft versions |
| Pipeline | `/api/pipeline` | application stages/history, tasks, calendar, analytics |
| Connectors | `/api/connectors` | bounded GitHub snapshot |
| Agent | `/api/agent` | providers, chat, conversations, proposed-change decisions |
| Taxonomy | `/api/taxonomy` | local ESCO search/status |
| Workspace | `/api/workspace` | Today summary and portable export |
| Operations | `/api/health/*`, `/metrics` | liveness, readiness, Prometheus |

## Browser contract

Login sets an HttpOnly opaque session cookie and a readable CSRF cookie. Every mutating request must include the CSRF value in `X-CSRF-Token`; requests include credentials. Production cookies are secure and same-site lax. CORS uses an explicit allowlist.

## Errors and privacy

Errors are bounded and sanitized. Connector/provider errors report class/category without credentials or upstream response bodies. Source list/export excludes storage keys and extracted document contents. Data export is CSRF-protected and returned as a private ZIP.
