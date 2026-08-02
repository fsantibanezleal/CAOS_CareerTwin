# Privacy model

CareerTwin is user-controlled career research, not an employer selection product. Data minimization starts with one person per workspace and user-selected opportunities/sources.

## Data categories and purpose

- Account metadata: authentication and preferences.
- Professional data and evidence: user-requested profile management and matching.
- Opportunity/application data: personal job-search research and organization.
- Conversations/model context: user-requested assistance.
- Audit/operational data: security, debugging, and accountability.

## Storage and disclosure

Canonical data is in the private database; source bytes are in private blob storage. Public Git contains none of it. GitHub tokens are request-memory-only. Provider and observability keys are server environment only. Confirmed evidence and optional opportunity context are disclosed to the provider chosen by the user/operator for a chat turn; the UI names that provider. Optional Langfuse observations receive redacted operational metadata only: hashed subject, input digest, counts, provider/specialist labels, attempt and terminal status—not prompts, evidence, answers, email/account values, or raw workspace IDs.

## User controls

The seeker can review/reject extracted claims, edit profile/opportunities, import/export a portable profile, delete conversations and opportunities, cancel/retry agent runs, exchange calendar events, export all canonical data, change password, and request account disable/purge from the superuser. Disable is recoverable; purge is explicit and irreversible. Retention schedules are operator-configurable and must include backups.

## Sensitive inference

CareerTwin does not infer race, ethnicity, sex/gender, pregnancy, disability, health, religion, political belief, union status, sexual orientation, age, personality, or other protected/sensitive traits. Such fields are excluded from matching and agent change allowlists.

## Open-source boundary

Example data, tests, screenshots, issues, and documentation must be synthetic. Before every release, run secret/history scans and verify ignored runtime paths. If a secret enters Git, removal does not revoke it: rotate first, then clean history according to the incident runbook.
