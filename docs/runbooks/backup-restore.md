# Backup and restore

## Backup set

A recoverable set includes PostgreSQL and the blob volume from the same operational window, the deployed commit/image digest, migration revision, and the private environment/secret-store configuration. The database-backed worker has no separate queue backup: pending and running state is canonical in PostgreSQL.

Run `scripts/backup.ps1` or `scripts/backup.sh`. The default path `backups/private/` is ignored. Blob files are copied through the Docker API and archived by the operator host, so the procedure does not assume that the non-root, distroless app image contains a shell, `tar`, or `rm`. The blob archive has one top-level `blobs/` directory. Encrypt and copy the set off-host; record a checksum and retention class without exposing names from user data.

## Restore test

Run `restore-check.*` against an explicitly selected SQL backup. It creates only
`careertwin_restore_check` from `template0` with PostgreSQL's versioned built-in `C.UTF-8` locale
provider, restores with `ON_ERROR_STOP`, counts schema tables, and drops that isolated database in a
finally/trap. The built-in provider keeps logical-restore verification independent from operating
system collation metadata. A successful isolated built-in-locale restore is the recovery gate. For
a full drill, restore blobs to an isolated volume, start the exact release on an unused hostname,
verify login/profile/source references/opportunities/matches/tasks, and destroy the isolated drill
environment.

Before changing the libc or locale runtime beneath an existing physical volume, rehearse the exact
release against a consistent physical clone such as `pg_basebackup`. Record every database's
`datcollversion` and `pg_database_collation_actual_version(oid)`, confirm the pgvector extension
matches the candidate image, and exercise representative vector operations. During the production
gate, keep a verified recovery set, stop the app and worker, and for each versioned database
(`careertwin`, `postgres`, and `template1`) run `REINDEX DATABASE` while connected to that database,
then `ALTER DATABASE ... REFRESH COLLATION VERSION`. `template0` intentionally has a `NULL` recorded
version and must not be force-refreshed. Restart PostgreSQL and prove all versioned databases match,
the application count/migration contracts are unchanged, pgvector matches the image, and no new
collation warning appears before restarting application writers. Never mutate `pg_catalog`
directly or suppress the warning.

Never call a backup verified until a restore test succeeds. Before production migration, confirm a recent verified set and available disk space.
