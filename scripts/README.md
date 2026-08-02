# Operator scripts

PowerShell and POSIX shell entrypoints cover setup, Compose or code-mode development, account bootstrap, full verification, diagnostics, ESCO import, private backup, and isolated restore testing. Run them from any directory; each resolves the repository root itself.

`release-smoke.py` runs a synthetic, self-cleaning live API journey through profile evidence,
durable document extraction, opportunities, matching, recommendations, artifacts, pipeline/calendar,
the browser extension credential lifecycle, and a durable local-provider agent run. Supply the base
URL and disposable credentials only through `CAREERTWIN_SMOKE_*` environment variables; the script
never writes or prints them and always purges the temporary seeker.

`representative-load.py` creates an ephemeral synthetic database with 10 seekers, 100 opportunities, 50 documents, and 50 GitHub repositories per seeker. It verifies exact cardinalities and measures 50 authenticated dashboard, graph, landscape, and portfolio reads with a 2.5-second p95 release threshold. It never points at configured development or production data.

The frontend toolchain requires Node.js 24 LTS. This version is pinned in `.nvmrc`, CI, and the container build.

Secrets and generated runtime files belong only in ignored `.env`, `data/`, `.run/`, and `backups/private/` paths. Backup scripts restrict the private directory to the current operator and the generated database/blob files to owner-only access. The scripts never add them to Git.
