# Privacy model

CareerTwin is user-controlled career research, not an employer selection product. Data minimization starts with one person per workspace and user-selected opportunities/sources.

## Data categories and purpose

- Account metadata: authentication and preferences.
- Professional data and evidence: user-requested profile management and matching.
- Opportunity/application data: personal job-search research and organization.
- Conversations/model context: user-requested assistance.
- Audit/operational data: security, debugging, and accountability.

## Storage and disclosure

Canonical data is in the private database; source bytes are AES-256-GCM encrypted in private blob storage. Public Git contains none of it. GitHub tokens are request-memory-only. OAuth refresh tokens are encrypted with tenant/provider/purpose binding; browser credentials and sessions are stored only as digests. Imported recruiting-email excerpts have bounded retention and calendar/email synchronization runs only after explicit consent. Provider and observability keys are server environment only. Confirmed evidence and optional opportunity context are disclosed to the provider chosen by the user/operator for a chat turn; the UI names that provider. The default Compose provider is private Ollama. Optional Langfuse observations receive redacted operational metadata only: hashed subject, input digest, counts, provider/specialist labels, attempt and terminal status—not prompts, evidence, answers, email/account values, or raw workspace IDs.

## User controls

The seeker can review/reject extracted claims, retry failed extraction, edit profile/opportunities, curate STAR/resume artifacts, import/export a portable profile, delete conversations and opportunities, cancel/retry agent runs, connect/disconnect calendar and read-only email, revoke browser credentials, export all canonical data, change password, and request account disable/purge from the superuser. Disable is recoverable; purge is explicit and irreversible and removes both relational data and the tenant's encrypted blob tree. Retention schedules are operator-configurable and must include backups.

## Sensitive inference

CareerTwin does not infer race, ethnicity, sex/gender, pregnancy, disability, health, religion, political belief, union status, sexual orientation, age, personality, or other protected/sensitive traits. Such fields are excluded from matching and agent change allowlists.

## Open-source boundary

Example data, tests, screenshots, issues, and documentation must be synthetic. Before every release, run secret/history scans and verify ignored runtime paths. If a secret enters Git, removal does not revoke it: rotate first, then clean history according to the incident runbook.
