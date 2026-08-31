# Threat model

## Assets

Credentials, sessions, profile evidence, documents/extracted text, GitHub snapshots, opportunities,
applications, conversations, provider/OAuth grants, email excerpts, calendar events, browser/voice
credentials, databases, encrypted blobs, backups, and audit evidence.

## Trust boundaries

Browser/API, browser/xAI Voice, extension/capture token, tenant/database, API/public URL, API/GitHub,
API/Google/Microsoft, worker/managed model provider, API/encrypted blobs, API/malware scanner,
app/worker/database queue, VPS/TLS proxy, backup/off-host storage, and public repo/private runtime.

## Principal threats and controls

| Threat | Controls |
|---|---|
| Credential/session theft | Argon2id, opaque high-entropy digest-stored sessions, HttpOnly/secure cookies, expiry, revocation |
| CSRF/CORS | double-submit CSRF, same-site cookies, explicit origin allowlist, no credentialed wildcard |
| Cross-tenant IDOR | workspace predicates, ownership validation, hosted forced RLS, two-account tests |
| Admin overreach | account metadata/lifecycle only; no other-user content route or workspace selector |
| Malicious uploads | magic/structure checks, archive/page/size bounds, production malware scan fail-closed, encrypted non-web storage |
| SSRF/DNS rebinding | public HTTP(S) only, no credentials/nonstandard ports, reject non-global IPs, pin validated IP, revalidate redirects, bounded response |
| Prompt injection | untrusted content is data, no arbitrary model tools, bounded context, typed output, evidence critic, explicit approval |
| Managed-provider disclosure | explicit provider, environment-only key, bounded confirmed context, non-retained image request, transient file TTL plus deletion |
| Voice exposure | five-minute ephemeral secret, no-store response, same-origin-only microphone policy plus explicit browser consent, browser-to-xAI WebSocket, server key never in browser, audio-track cleanup |
| Secret leakage | environment-only keys, encrypted grants, digest-only credentials, audit redaction, GitHub token never persisted, secret scans |
| Blob disclosure | AES-256-GCM tenant/key-bound envelopes, storage outside web root, owner-only backups, migration tooling |
| Excessive connector access | PKCE, one-time state, service-specific scopes, read-only email, explicit bounded sync, retention/disconnect/revoke controls |
| Supply-chain compromise | exact Python pins, npm lockfile, supported Node line, dependency audits, CodeQL, image scan, SBOM |
| Data loss/ransomware | persistent canonical store, encrypted off-host backup, isolated restore tests |
| Duplicate/abandoned work | database row claims, locks, explicit states, lineage-preserving retry, conservative interruption recovery |
| Denial of service | upload/URL/context bounds, worker batch limits/timeouts, reverse-proxy rate limits, low-cardinality metrics |
| Misleading decisions | deterministic versioned scoring, separate eligibility, coverage/bounds, no protected traits or hiring-probability claim |

## Residual risk

Operators control VPS access, provider/OAuth contracts, backups, TLS, runtime roles, monitoring, and
legal compliance. Parsers and external APIs remain attack surfaces. CareerTwin does not provide MFA,
hardware-backed per-user keys, or distributed application rate limiting; public deployments must
restrict invitations and add reverse-proxy rate limits.
