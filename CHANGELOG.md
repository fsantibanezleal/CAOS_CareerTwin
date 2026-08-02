# Changelog

All notable changes follow Keep a Changelog. CareerTwin uses semantic versioning.

## [Unreleased]

## [0.1.0-alpha.4] - 2026-08-02

### Security

- Restrict POSIX private-backup directories to mode 0700 and generated SQL/blob files to mode 0600,
  including files copied from containers.
- Remove inherited Windows ACLs from private backups and grant access only to the current operator.

## [0.1.0-alpha.3] - 2026-08-02

### Added

- Lossless tenant-scoped CareerTwin profile/evidence interchange plus JSON Resume import/export.
- Immutable opportunity revision snapshots, named target portfolios, weighted portfolio alignment,
  and a repeated-gap recommendation matrix.
- Editable recommendation prerequisites, steps, status, effort and progress with direct agenda-task
  conversion.
- Candidate-owned contacts and bounded, UID-idempotent RFC 5545 calendar import.
- PostgreSQL-backed queued agent checkpoints with ARQ execution, polling, cancellation, retry lineage,
  safe terminal errors, and optional redacted Langfuse observations.
- Web controls for every new contract, a serious/critical automated accessibility gate, and the fixed
  10-seeker representative-volume test.
- A seventh versioned repository skill for application, contact, agenda and calendar operations.

### Changed

- Upgrade the Langfuse integration to its current v4 SDK surface and keep prompts, evidence bodies,
  outputs, account values and raw workspace identifiers outside observations.
- Extend workspace export, tenant RLS migration coverage, CI, operator scripts, API documentation,
  and deployment checks for the completion contracts.

### Security

- Validate every target-set, contact, task and durable-run relationship against the current tenant.
- Preserve request-memory-only GitHub tokens and environment-only provider/observability secrets.

## [0.1.0-alpha.2] - 2026-08-02

### Fixed

- Parse both JSON and comma-separated `ALLOWED_ORIGINS` before Pydantic Settings' complex-value
  decoder, normalize duplicates, and reject wildcard or path-bearing origins.

### Changed

- Pin every GitHub Action to an immutable reviewed revision and move supported actions to their
  current major release.
- Group routine Dependabot updates while requiring explicit migration work for major runtime and
  library changes.

## [0.1.0-alpha.1] - 2026-08-01

### Added

- Initial evidence-centered career profile, opportunity, matching, recommendation, pipeline,
  agent, administration and visualization platform.
