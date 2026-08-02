---
name: operate-career-twin
description: Set up, run, diagnose, back up, restore-test, upgrade, and deploy a private CareerTwin instance. Use for local development, Docker Compose, superuser bootstrap, PostgreSQL and Redis operations, ClamAV, provider configuration, health checks, VPS releases, or incident response. Never commit secrets, runtime data, tokens, personal exports, database files, or backup archives.
---

# Operate CareerTwin

Skill contract version: 1.0.0.

## Source of truth

Read `Entry_point.md`, then `references/operator-contract.md` and the relevant file under `docs/runbooks/`. Treat `.env.example` as names and placeholders only. Runtime `.env`, passwords, provider keys, database contents, blobs, backups, and exports are private.

## Local workflow

1. Run `scripts/setup.ps1` on Windows or `scripts/setup.sh` on Linux/macOS.
2. Copy `.env.example` to ignored `.env` and set unique local secrets.
3. Run migrations, then create the first account using the bootstrap script. Supply the password interactively or through a one-process environment variable; never echo it.
4. Start with `scripts/dev.ps1`/`.sh` or Docker Compose.
5. Run `scripts/verify.ps1`/`.sh` before trusting the instance.

## Production workflow

1. Use PostgreSQL with pgvector, Redis, ClamAV, TLS, secure cookies, private blob storage, and encrypted off-host backups.
2. Inject secrets from the VPS secret store. Never bake them into an image, Compose file, CI log, GitHub secret output, or shell history.
3. Back up before migrations. Deploy an immutable image or pinned commit. Run migrations once as the database owner.
4. Verify liveness, readiness, login, tenant isolation, profile upload/review, opportunity capture, match semantics, pipeline, configured agent provider, and restart persistence.
5. Run a restore test to an isolated database and record the evidence. A backup without a restore test is not verified.

## Incident rules

- Revoke sessions after suspected credential exposure.
- Rotate the affected secret and provider key; do not paste it into an issue.
- Preserve redacted logs and audit events.
- Prefer disabling an account to purge. Purge requires exact confirmation and a validated backup decision.

## Completion

Report version/commit, migration revision, health results, tests, backup and restore-test identifiers, deployment target, and any check that could not be completed. Never print credentials or personal data.
