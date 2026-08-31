# ADR 0003: One seeker per account with dual tenant enforcement

- Status: Accepted
- Date: 2026-08-01

## Decision

Each user owns one workspace and professional profile. Every career-content row has `workspace_id`; API queries include it and production PostgreSQL forces RLS using request transaction context. Superusers manage account metadata/lifecycle but receive no cross-account content API.

## Consequences

The data model matches the product and reduces ambiguous sharing. Defense in depth needs two-account IDOR tests and a non-owner runtime database role. Teams, coaches, household sharing, and employer workspaces require a future ADR rather than an ad hoc workspace selector.
