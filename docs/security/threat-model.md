# Threat model

## Assets

Account credentials, sessions, profile facts, uploaded documents, extracted text, GitHub snapshots, opportunity research, application history, conversations, provider/OAuth keys and grants, recruiting-email excerpts, calendar events, browser credentials, database/blobs/backups, and audit evidence.

## Trust boundaries

Browser/API, browser extension/capture token, tenant/database, API/external URL, API/GitHub, API/Google/Microsoft, API/model providers, API/encrypted blob store, API/ClamAV/Docling, app/worker/Redis, VPS/reverse proxy, backup/off-host storage, and public repository/private runtime.

## Principal threats and controls

| Threat | Controls |
|---|---|
| Credential/session theft | Argon2id, opaque high-entropy tokens stored as hashes, HttpOnly/secure cookies, revocation, expiry, password-change revocation |
| CSRF/CORS | double-submit CSRF header, same-site cookies, explicit origins, no wildcard credentials |
| Cross-tenant IDOR | workspace predicates on every content query, ownership validation, forced PostgreSQL RLS, two-account tests |
| Admin overreach | account-metadata endpoints only; no other-user workspace selector or content route |
| Malicious uploads | byte/magic validation, bounded DOCX/PDF/archive/page/size limits, quarantine, production ClamAV fail-closed, storage outside web root |
| SSRF/DNS rebinding | HTTP(S) only, no credentials/nonstandard ports, reject local names and every non-global resolved IP, pin the validated IP while preserving TLS hostname verification with TLS 1.2+, revalidate every redirect, bounded response |
| Prompt injection | content treated as data, no arbitrary model tools, bounded context, structured output, evidence critic, human approval |
| Secret leakage | environment-only keys, encrypted OAuth grants, hashed sessions/browser credentials, recursive audit redaction, GitHub token never persisted, public-repo secret scans |
| Source/blob disclosure | AES-256-GCM tenant/key-bound envelopes, storage outside web root, owner-only backup permissions, explicit legacy encryption migration |
| Excessive connector access | PKCE, one-time state, service-specific delegated scopes, read-only email, user-triggered sync, bounded retention, disconnect/revoke controls |
| Supply-chain compromise | exact Python pins, lockfile, dependency review/audit, CodeQL, container scan, SBOM |
| Data loss/ransomware | persistent volumes, explicit backups, encrypted off-host copies, isolated restore tests |
| Denial of service | upload/URL limits, provider/context bounds, worker timeouts, rate-limit seam, low-cardinality metrics |
| Misleading decision support | deterministic versioned scoring, eligibility separation, coverage/bounds, no protected traits, no hiring-probability claim |

## Residual risk

Self-hosting operators control the VPS, OAuth/model contracts, backups, TLS, runtime roles, monitoring, and legal compliance. Document parsing and external APIs remain attack surfaces. Version 0.2.0 does not provide multi-factor authentication, hardware-backed per-user keys, or distributed application-level rate limiting; public Internet deployments must add a reverse-proxy rate limit and restrict invitations.
