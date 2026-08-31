# ADR 0016: Public code, private runtime data

- Status: Accepted
- Date: 2026-08-01

## Decision

Publish code, migrations, synthetic tests, documentation, and skills under MIT. Exclude every secret, credential, runtime `.env`, document/blob, database, log, export, backup, PID, and personal screenshot/fixture through repository policy and automated scanning.

## Consequences

The community can audit and self-host without inheriting personal data. Operators need an external secret/deployment register. Git ignore is not a security boundary: CI/history scans and incident rotation remain mandatory.
