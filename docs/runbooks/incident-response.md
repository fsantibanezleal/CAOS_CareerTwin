# Incident response

1. Contain: disable affected accounts, revoke sessions, stop a connector/provider, or remove public exposure without deleting evidence.
2. Rotate: database/app/CSRF/provider/GitHub credentials as applicable. Rotation is required even if Git history is later cleaned.
3. Preserve: copy redacted logs, audit events, deployment revision, and timing to private incident storage. Never paste user content into a public issue.
4. Assess: identify affected tenants, data categories, provider disclosures, backups, and legal notification duties.
5. Recover: deploy a reviewed fix, restore only from verified artifacts if needed, and verify all tenant/security boundaries.
6. Learn: publish a sanitized advisory when appropriate and add a regression test/ADR/runbook update.

For suspected upload malware, retain only the minimum quarantined identifier and scanner result; do not open the file on an operator workstation. For a leaked GitHub token, revoke it at GitHub immediately and ask the seeker to issue a new minimal token only when needed.
