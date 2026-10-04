# Bounded VPS rollback and image retention

CareerTwin's hosted image store is not a release archive. Retain the running release plus two
explicit reviewed application/database pairs. GitHub retains source history; the VPS retains only
the bounded operational rollback window. Preserve all container-referenced images, even if that
temporarily exceeds the window. Do not delete a container merely to make its image reclaimable.

## Safety contract and design

The server-only, standard-library `scripts/vps-images.py` reads Docker identity metadata, local Git
tags and loopback readiness. It never reads `.env`, application records or uploaded documents.
`plan` is read-only; `clean` without `--apply` is also a dry run. Cleanup refuses missing pins,
replaced tag identities, mixed/stopped runtime services, changed inventories and migration drift.
It removes exact `careertwin-app:` / `careertwin-db:` tags without Docker's force-removal flag.
It does not prune volumes, stopped containers, other repositories, dangling images of unknown
ownership, databases, backups, host directories or filesystem caches.

Private state defaults to ignored `.run/vps-operations/`, mode 0700; JSON files are atomic mode
0600 writes. `rollback.json` binds three Git commits, image IDs and migration-tree fingerprints.
`last-cleanup.json` records deletion progress, completion/failure and physical disk before/after.
Neither contains credentials or user identities. A nonblocking POSIX advisory lock serializes
maintenance. Operators must serialize deployments too: never deploy concurrently with cleanup.
Inventory rechecks catch changes outside the advisory lock but cannot replace operator discipline.

The migration fingerprint is a conservative retention gate, not a compatibility proof. These are
retained rollback candidates, not automatically approved live downgrades. No automatic rollback,
database image replacement, Alembic downgrade, Docker daemon restart or cron registration occurs.

## First-time adoption

Run on the VPS, from the reviewed checkout, after checking readiness and the selected tags' review
and deployment history. Example for the initial operational cleanup:

```bash
python3 scripts/vps-images.py checkpoint --keep-release v0.14.4 --keep-release v0.14.3
python3 scripts/vps-images.py plan
python3 scripts/vps-images.py clean --apply --prune-cache
python3 scripts/vps-images.py preflight
```

`--prune-cache` explicitly affects the host's shared **default** builder cache, not just CareerTwin.
It uses `docker buildx --builder default prune --force --max-used-space 2GB`: unused least-recently
used build records are removed toward a 2 GB budget, without removing tagged runtime images or
volumes. In-use/shared records can keep actual cache above the target; read `docker system df` and
the physical disk report afterward. Never sum image sizes as if shared layers were independent.
Do not run global `docker system prune -a`, `docker volume prune`, or delete containerd files by hand.

## Every subsequent deployment

1. Run `python3 scripts/vps-images.py preflight` **before** building. Require at least 10 GiB free
   and less than 80% physical use. Raise `--min-free-gib` if the measured build peak needs more.
2. Follow the [deployment runbook](vps-deployment.md), including backup/restore and any database
   runtime migration gates. Do not treat image retention as a substitute for recovery backups.
3. Complete the release's live, rendered and data-isolation checks. Record the migration head.
4. Run `bash scripts/finish-vps-release.sh --apply`. This explicitly rotates the old healthy current
   release into the newest rollback slot, keeps its previous newest rollback, checks the new healthy
   runtime, prints the cleanup plan, applies bounded cleanup, and rechecks capacity. It is a manual
   deployment step, not an unattended job. A repeated call on the same release preserves the pins.
5. Record the app commit separately from the maintenance-tool commit, image IDs, private journal
   identifier, measured space reclaimed, container identity stability and public readiness.

If migration trees differ, acceptance fails closed. Do not erase a pin to force cleanup. Preserve
the old checkpoint/images, rehearse against an isolated restored dataset, and establish an explicit
compatible pair after the schema review. Failed candidates do not enter the rollback window merely
because their tags look newer. Only a running healthy release can become the current checkpoint.

## Rollback procedure

1. Read `rollback.json` and select a pinned application tag. Resolve its Git commit and compare its
   local application image ID against the checkpoint. A changed ID is a stop condition.
2. Prove current schema/data compatibility in isolation using the selected image and a verified
   database/blob restore. A matching migration fingerprint alone is insufficient.
3. Preserve current production volumes and its database runtime. Set the application image tag
   explicitly for **app and worker only**, using an owner-only Compose override if necessary because
   the base Compose file shares one tag with the database. Never downgrade PostgreSQL by changing
   the shared `CAREERTWIN_IMAGE_TAG` and restarting the full stack.
4. Restart only app/worker, then verify readiness, authentication, representative saved data and the
   rendered workflows. Record the exact IDs and rollback result. Do not run migrations backward.
5. Resume forward release work. The tool refuses automatic backward checkpoint rotation; retain the
   incident's images until a reviewed recovery release establishes a new healthy checkpoint.

Removed images/cache are reproducible build artifacts, not recoverable through trash. Removed image
tags can be rebuilt from their reviewed Git tags and pinned base digests when dependencies remain
available. Cache is rebuilt on demand. No cleanup here claims to remove account data or stale backups.

## Executable gates

`tests/test_vps_images.py` covers missing/duplicate/newer pins, schema drift, image replacement,
mixed runtime, stopped-container references, aliases, unrelated images, inventory races, exact-tag
deletion, cache bounding, pin rotation and private-state symlink protection. Run locally with the
repository environment. Verify live cleanup with unchanged container IDs and health/version, then
inspect the owner-only journal and actual disk usage. No new application image is needed to deploy
this operator tool.

## Primary references

- [Docker unused-object pruning](https://docs.docker.com/engine/manage-resources/pruning/).
- [Buildx bounded cache pruning](https://docs.docker.com/reference/cli/docker/buildx/prune/).
- [Build cache garbage collection](https://docs.docker.com/build/cache/garbage-collection/).
