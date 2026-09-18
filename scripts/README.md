# Operator scripts

PowerShell and POSIX entrypoints resolve the repository root and keep local dependencies/data inside
ignored paths.

## Native lifecycle

- `setup.*`: verify Python 3.11+, create `.venv`, install Python dependencies, verify Node 24/npm 11, run lockfile-only `npm ci` into `frontend/node_modules`, and migrate SQLite.
- `bootstrap-superuser.*`: create the first private account with a non-echoed password.
- `dev.*`: start native FastAPI, database-backed worker, and Vite. Docker runs only with explicit `-Docker`/`--docker`.
- `stop.*`: stop only recorded repo-native PIDs, or the explicit Docker profile.
- `career.*`: credential-safe harness for repository skills and scripts.
- `test.*` and `verify.*`: static, unit/integration, evaluation, accessibility, i18n, build, volume, and live gates.

The harness supports `doctor`, `get`, generic JSON `request`, multipart `upload`, `profile-graph`,
`profile-upload`, `claim-decision`, `opportunity-url`, `opportunity-file`, `opportunity-graph`,
`match`, `recommend`, `github-review`, and durable external-provider `chat`. It never accepts a
password argument or an absolute URL.

## Hosted operations

Backup/restore and superuser scripts retain explicit Compose switches because Compose is a supported
optional VPS packaging profile. Those scripts are not required for local use. The hosted topology
contains PostgreSQL, app, database worker, encrypted blobs, and malware scanning—no Redis, Ollama,
Docling, embedding service, or model volume.

`release-smoke.py` runs a synthetic self-cleaning live journey. Supply disposable credentials only
through `CAREERTWIN_SMOKE_*` process environment. It never prints them and purges the temporary seeker.

`workbench-gate.mjs` measures the opportunity workbench against ADR-0071 on a live deployment:
every saved role at 1280x800, 1600x900 and 2560x1440 in both themes, checking document scroll,
controls cut off the bar, requirements clipped by the brief, label clipping, text under 12px, and
that the fit shown equals the stored score on first paint. Credentials come only from
`CAREERTWIN_GATE_*` process environment. Playwright is not a project dependency; the file header
gives the install line. Screenshots go to the ignored `.run/workbench-gate/`.

`representative-load.py` uses an ephemeral synthetic database for exact cardinality/latency checks;
it cannot target configured personal or production data.

Secrets and generated runtime files belong only in ignored `.env`, `.venv`, `frontend/node_modules`,
`data/`, `.run/`, and `backups/private/` paths. Never add them to Git.
