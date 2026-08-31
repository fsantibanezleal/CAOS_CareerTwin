# Privacy model

CareerTwin is user-controlled career research, not an employer selection product. One person owns
each workspace and chooses every source, opportunity, connector, provider turn, and canonical change.

## Data and purpose

- Account metadata supports authentication and preferences.
- Professional evidence supports the user's profile, graphs, matching, and artifacts.
- Opportunity/application data supports personal job research and organization.
- Visible conversations and citations support user-requested assistance.
- Redacted audit/operational data supports security and reliability.

## Storage and disclosure

Canonical data stays in the private SQLite/PostgreSQL database. Source bytes are AES-256-GCM
encrypted in tenant-namespaced blob storage. Public Git contains none of it. Sessions and browser
credentials are digest-only; OAuth refresh grants are encrypted with tenant/provider/purpose binding;
GitHub tokens exist only for one request in memory.

Confirmed evidence and optional opportunity context are disclosed only to the managed provider
selected for a user-requested turn; the UI names it. There is no local or undisclosed fallback.
Images/scanned PDFs are sent to xAI only when configured; remote files receive an expiry safety net
and immediate deletion attempt. Grok Voice audio flows browser-to-xAI with a short-lived credential
and does not pass through the VPS.

Optional Langfuse observations contain only hashed subjects, digests, counts, lifecycle/provider
labels, attempts, and status. Prompts, evidence, answers, email/account values, credentials, and raw
workspace IDs are prohibited.

## User controls

The seeker reviews/rejects claims, edits profile/opportunities, curates artifacts, imports/exports a
portable profile, deletes conversations/opportunities, cancels/retries runs, connects/disconnects
calendar/read-only email, revokes browser credentials, exports canonical data, and changes password.
Superusers may disable or explicitly purge accounts but cannot browse career content. Disable is
recoverable; purge is irreversible and includes the tenant blob tree. Backup retention is operator-owned.

## Sensitive inference

CareerTwin does not infer or score race, ethnicity, sex/gender, pregnancy, disability, health,
religion, political belief, union status, sexual orientation, age, personality, or other protected
traits. Missing evidence means unknown, never weak or unemployable.

## Public-repository boundary

Examples, tests, screenshots, issues, docs, and skill payloads must be synthetic. `.env`, `.venv`,
`node_modules`, databases, blobs, logs, exports, backups, provider keys, and personal documents are
ignored. Run secret/history scans before releases. If a secret enters Git, rotate it first; history
cleanup does not revoke it.
