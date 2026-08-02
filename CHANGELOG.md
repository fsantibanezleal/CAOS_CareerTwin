# Changelog

All notable changes follow Keep a Changelog. CareerTwin uses semantic versioning.

## [Unreleased]

## [0.2.2] - 2026-08-02

### Fixed

- Validate blob and connector AES-256 keys as canonical padded or unpadded URL-safe base64 during
  settings construction, before the application accepts traffic.
- Publish the validated encryption-key dependency in production readiness and document the exact
  32-byte key-generation contract.

## [0.2.1] - 2026-08-02

### Fixed

- Make PostgreSQL and encrypted-blob backup entrypoints compatible with the non-root, distroless
  application image by copying the volume through the Docker API and creating the private archive
  on the operator host.
- Constrain temporary blob-backup cleanup to a resolved staging directory under the ignored,
  owner-only backup root.

## [0.2.0] - 2026-08-02

### Added

- Encrypted tenant-namespaced document storage, private Docling conversion, queued extraction,
  visible retry state, versioned structured-output prompts, deterministic evidence criticism, and
  redacted tenant-scoped run traces.
- ESCO 1.2.1 and O*NET 30.3 concept/relation imports, local EmbeddingGemma vectors, hybrid search,
  HNSW indexing, persisted archive provenance, checksum-gated O*NET acquisition, and a pinned
  bilingual retrieval benchmark.
- Evidence-backed STAR accomplishments and immutable tailored résumé variants.
- Consent-bound Google and Microsoft OAuth connections for user-triggered calendar synchronization
  and read-only, bounded recruiting-email excerpts with finite retention.
- Revocable browser-capture credentials and a Manifest V3 extension for explicit, visible-page job
  capture without background crawling.
- Private Ollama and authenticated Docling services in the production Compose topology.

### Changed

- Make private Ollama `qwen2.5:0.5b-instruct-q4_K_M` the measured CPU-safe production baseline,
  with bounded context/output settings, while retaining typed optional xAI, OpenAI, Anthropic, and
  Google adapters.
- Extend the web workbench, APIs, worker lifecycle, repository skills, runbooks, and ADR catalog for
  document intelligence, career artifacts, connectors, and hybrid occupational retrieval.

### Security

- Reject deterministic mock/test providers in production and fail readiness when the configured real
  provider, model, scanner, converter, database, or queue is unavailable.
- Encrypt OAuth refresh tokens with purpose-bound authenticated data; never expose stored secrets to
  the browser, and request no mailbox write/send scope.
- Preserve exact-quotation evidence, protected-term, duplicate, tenant-isolation, expiry, and
  idempotency gates across extraction and connector workflows.
- Upgrade the pinned runtime to a non-root, distroless Python 3.14.6 image with a separate
  development-only builder after fixable-high image scans rejected the previous Python base.
- Replace vulnerable vendor database, model-server, and document-service images with scanned custom
  runtimes: PostgreSQL 17.10 plus pgvector 0.8.1, patched CPU-only Ollama 0.32.5, and a distroless
  Docling gateway that uses bounded English/Spanish Tesseract OCR without EasyOCR, OpenCV, or
  bundled FFmpeg.

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
