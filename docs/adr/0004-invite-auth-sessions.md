# ADR 0004: Invite-only local authentication and opaque sessions

- Status: Accepted
- Date: 2026-08-01

## Decision

No public registration. Superusers/bootstrap create accounts. Passwords use Argon2id; browser sessions and CSRF tokens are random opaque values whose keyed hashes are stored server-side. Sessions are revocable and expire; production cookies are secure, HttpOnly for session, same-site lax.

## Consequences

Self-hosted operation has no external identity dependency and can revoke sessions immediately. Operators manage invitations/recovery; MFA and OIDC are deferred. Test Argon2 parameters are lower only under explicit test environment to keep security tests practical.
