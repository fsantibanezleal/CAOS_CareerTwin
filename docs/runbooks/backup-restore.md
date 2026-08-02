# Backup and restore

## Backup set

A recoverable set includes PostgreSQL and the blob volume from the same operational window, the deployed commit/image digest, migration revision, and the private environment/secret-store configuration. Redis is rebuildable and is not canonical.

Run `scripts/backup.ps1` or `scripts/backup.sh`. The default path `backups/private/` is ignored. Blob files are copied through the Docker API and archived by the operator host, so the procedure does not assume that the non-root, distroless app image contains a shell, `tar`, or `rm`. The blob archive has one top-level `blobs/` directory. Encrypt and copy the set off-host; record a checksum and retention class without exposing names from user data.

## Restore test

Run `restore-check.*` against an explicitly selected SQL backup. It creates only `careertwin_restore_check`, restores with `ON_ERROR_STOP`, counts schema tables, and drops that isolated database in a finally/trap. For a full drill, restore blobs to an isolated volume, start the exact release on an unused hostname, verify login/profile/source references/opportunities/matches/tasks, and destroy the isolated drill environment.

Never call a backup verified until a restore test succeeds. Before production migration, confirm a recent verified set and available disk space.
