# Operator scripts

PowerShell and POSIX shell entrypoints cover setup, Compose or code-mode development, account bootstrap, full verification, diagnostics, ESCO import, private backup, and isolated restore testing. Run them from any directory; each resolves the repository root itself.

The frontend toolchain requires Node.js 24 LTS. This version is pinned in `.nvmrc`, CI, and the container build.

Secrets and generated runtime files belong only in ignored `.env`, `data/`, `.run/`, and `backups/private/` paths. The scripts never add them to Git.
