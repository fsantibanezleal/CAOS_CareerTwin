# Release verification

Successful compilation or HTTP readiness is not acceptance. Verify exact reviewed source,
the immutable release tag, native contracts, both final image scans and the real user workflow.
Keep operational evidence and coordination in the deployment operator's control repository;
never commit private profiles, live employer content, credentials or backups here.

## Native and security gates

Run the supported verification scripts, full backend/frontend contracts, strict typing/lint,
dependency audit, agent evals, version consistency and representative-load contract. Do not lower
coverage or scan thresholds. Distinguish deterministic/contract-provider tests from actual
external-provider execution. See [local operation](local-development.md) and the
repository scripts for their supported interfaces.

## Release transition and browser acceptance

Confirm the SPA landing and deep-link HTML has `Cache-Control: no-store, max-age=0` and the current
content-hashed assets are served. An already-open old client may need an explicit reload after an
upgrade. Route failures must retain navigation, explain recovery in EN/ES and warn about unsaved
edits; never silently reload or expose raw private exception content.

Use a disposable isolated seeker, not the owner's password or production career records, to verify
the actual HTTPS UI through clicks. Check EN/ES, light/dark, desktop and phone layouts, keyboard
navigation, internal scrolling and all changed panels. Record actual failures rather than
substituting successful route fetches for rendered verification.

For job discovery, search both documented public feeds, inspect source attribution and restrictions,
save only into the disposable workspace, repeat import and assert duplicate prevention, verify
workspace-bound ticket denial and private named queries. No search implicitly applies for a job.
Verify authenticated plain-text source access, `no-store`/`nosniff` and foreign-workspace denial.

Exercise malware-scanned upload through the durable worker, matching with evidence/unknown
semantics, recommendations, artifact generation and application/calendar operations. Remove only
the test account and its own fixtures, then assert the owner's records and statuses are preserved.
Respect the proxy's request shaping; pace bulk tests rather than relaxing production rate limits.

## External activation and recovery

Real agent and voice acceptance requires a dedicated configured provider and explicit microphone
permission. Missing credentials mean unconfigured, never simulated completion. ESCO import requires
the consented official archive; private GitHub review requires a separately granted read-only token.

Before mutation, create private database/blob backups, restore SQL into an isolated database and
verify recipient-encrypted copies off-host against original digests. The decryption identity must
not be on the server or in Git. Preserve persistent volumes and unrelated applications. After all
checks, follow [bounded image retention](image-retention.md); retained candidates do not by
themselves establish that a live database downgrade was rehearsed.
