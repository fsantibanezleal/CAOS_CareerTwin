# Changelog

All notable changes follow Keep a Changelog. CareerTwin uses semantic versioning.

## [Unreleased]

## [0.5.5] - 2026-08-31

### Fixed

- Remount the locale provider at the anonymous-to-authenticated account boundary so the saved
  account language immediately replaces browser-detected anonymous copy after sign-in.

## [0.5.4] - 2026-08-31

### Fixed

- Make every skip-link destination programmatically focusable so activating the keyboard-only
  control transfers focus to the main landmark on boot, login, and authenticated workbench views.

## [0.5.3] - 2026-08-30

### Changed

- Refresh the pinned Node 24 builder, public shared workbench, React-query and graph packages,
  Python runtime libraries, and immutable GitHub Actions toolchain through reviewed dependency PRs.

### Fixed

- Keep the browser document exactly viewport-sized and assign long authenticated routes to one
  internal workbench scroller, including safe mobile bottom-navigation clearance.
- Replace the always-visible static skip link with a localized keyboard-only control backed by a real
  main landmark on boot, login, and authenticated surfaces.
- Pin the transitive Nano ID development dependency to its advisory-fixed release.

### Security

- Build PostgreSQL 17.11 and pgvector 0.8.6 from verified upstream sources on a pinned minimal Wolfi
  runtime, with fresh-cluster network readiness and collation-upgrade rehearsal gates.

## [0.5.2] - 2026-08-15

### Fixed

- Expose language and theme actions inside the account menu so phone-width users retain both
  preference controls when the compact header hides their duplicate top-bar icons.

## [0.5.1] - 2026-08-15

### Changed

- Refresh the pinned Python and frontend dependency contracts and the GitHub Actions toolchain.
- Rebuild the application and PostgreSQL containers from current immutable, vulnerability-scanned
  base images while preserving the PostgreSQL 17.10, pgvector 0.8.6, and collation contracts.

### Security

- Remove the remaining known high-severity base-image findings without weakening the non-root
  runtime, digest pinning, SBOM, secret scanning, or exact dependency gates.

## [0.5.0] - 2026-08-04

### Added

- Add an evidence-derived four-step dashboard journey from trusted profile through target role,
  match review, and next action, with responsive progress and direct work-surface links.
- Add deterministic bounded ForceAtlas2 relationship layouts, fit/reset and selected-neighborhood
  controls, and a shared inspector across network, adjacency-matrix, and table graph lenses.
- Add selectable ranked opportunity-landscape lenses, zoomable career-duration ranges, exact data
  tables, and lowest-supported-first match category explanations.

### Changed

- Make ECharts theme-reactive, reduced-motion aware, container-responsive, and ARIA/decal described;
  escape user-controlled career labels before building chart tooltips.
- Raise graph matrix targets to 26 CSS pixels, improve visualization text/contrast, strengthen focus
  indication and responsive layouts, and make the advertised `Ctrl/Command+K` shortcut functional.
- Extend automated accessibility from login to the authenticated shell and run color-contrast checks
  instead of disabling them.

### Fixed

- Correct corrupted Spanish conversation strings and provide complete Spanish copy for the new
  guidance, graph, and analytical controls.

## [0.4.1] - 2026-08-03

### Fixed

- Run the PostgreSQL 17.10 deployment image on digest-pinned Wolfi/glibc with exact package versions
  so a database cluster carrying glibc collation provenance can verify its recorded version instead
  of emitting a no-actual-collation-version warning on every connection under Alpine/musl.
  Production upgrades rebuild affected indexes and refresh the recorded version before normal
  service resumes, while the database runtime continues to pass the zero-high-vulnerability
  container gate.
- Align the pgvector runtime with the persistent cluster's 0.8.6 extension metadata so the release
  never places an older shared library beneath newer stored extension objects.

### Security

- Keep PostgreSQL and pgvector immutable-pinned while removing direct system-catalog suppression as
  an option: collation compatibility must be demonstrated by the runtime and an isolated backup
  restore before deployment.

## [0.4.0] - 2026-08-03

### Changed

- Render the authenticated workbench through the exact public
  `@fasl-work/caos-app-shell@0.5.0` `WorkbenchShell`, retaining CareerTwin's five seeker routes,
  responsive navigation, command search, locale/theme persistence, account controls, career copilot,
  architecture modal, security banner, and product-specific design tokens through typed slots.
- Adopt the shared package's React Router 6/7/8 core contract without downgrading CareerTwin Router 8
  or mixing incompatible DOM/core majors.

### Added

- ADR 0027 and a frontend integration test proving the real shared frame, active route, navigation and
  main landmarks, product controls, overlays, and authenticated content.

### Security

- Pin the public shell package exactly, keep npm audit at zero findings, and preserve all account,
  preference, chat, modal, and authorization state inside CareerTwin rather than the shared package.

## [0.3.1] - 2026-08-03

### Fixed

- Allow only the same-origin CareerTwin document to request explicit browser microphone permission,
  restoring the Grok Voice client while camera, geolocation, and cross-origin microphone delegation
  remain denied.

## [0.3.0] - 2026-08-03

### Added

- Native-first local lifecycle that creates repo-root `.venv`, installs the Python contract, verifies
  Node 24/npm 11, installs the frontend lockfile into `frontend/node_modules`, migrates SQLite, and
  starts API, database worker, and web without Docker.
- Credential-safe `scripts/career.*` harness for profile/opportunity graphs, source capture, evidence
  decisions, matching, recommendations, GitHub review, arbitrary bounded API calls, and durable chat.
- Typed opportunity knowledge graph connecting roles, employers, shared requirements, industry,
  seniority, location, work mode, and target portfolios.
- Searchable network, adjacency-matrix, table, facet, and inspector lenses shared by professional and
  opportunity graphs.
- External xAI document understanding and Grok Realtime Voice with server-minted ephemeral browser
  credentials; eight validated versioned repository skills.
- AST-based Spanish coverage gate for literal UI translation keys.

### Changed

- Make the repository—not the hosted web app—the product boundary. Docker is optional deployment
  packaging; SQLite is the native local profile and PostgreSQL the hosted multi-user profile.
- Replace Redis/ARQ with durable database row claiming and conservative interruption recovery.
- Replace local Ollama/Docling/embedding inference with explicitly configured managed xAI, OpenAI,
  Anthropic, or Google APIs. Deterministic parsers remain the no-provider fallback.
- Make xAI file processing transient with one-hour expiry safety and immediate deletion attempt.
- Expand EN/ES coverage across the control room, profile, opportunities, matches, pipeline, admin,
  connectors, agent states, graphs, and deterministic recommendations.

### Removed

- Ollama, Qwen, local embeddings, Docling/OCR gateway, Redis, ARQ, model images, model volumes, and
  every production readiness dependency on local inference.

### Fixed

- Keep optional PowerShell superuser arguments as a true array, so a single flag is never splatted
  into individual characters.
- Make native launchers collision-safe with explicit API/web ports and stable background processes,
  including automatic Vite proxy alignment in concurrent worktrees.
- Apply bounded provider request duration and output-token limits to every managed model call.
- Expose durable copilot history controls and close microphone, audio, and socket resources across
  drawer close, component teardown, permission cancellation, and voice transport failures.

### Security

- Preserve secrets in ignored/runtime-only storage, keep GitHub and harness tokens memory-only,
  retain fail-closed production malware scanning, and keep every model-derived write behind exact
  evidence criticism plus explicit user approval.

## [0.2.5] - 2026-08-03

### Fixed

- Synchronize the root release manifest, Python package/runtime metadata, frontend package,
  browser extension, documentation, tag, and deployment version.
- Add a regression contract that rejects drift between canonical version surfaces.

## [0.2.4] - 2026-08-03

### Fixed

- Create isolated restore-check databases from `template0` with PostgreSQL 17's built-in `C.UTF-8`
  locale provider so recovery does not depend on host glibc/musl collation-version metadata.
- Initialize fresh Compose database volumes with the same portable locale contract and document the
  honest handling of warnings from legacy libc-initialized volumes.

## [0.2.3] - 2026-08-02

### Fixed

- Make the public release journey honor numeric `Retry-After` responses and bounded exponential
  backoff for idempotent status polling without ever replaying a state-changing request.
- Use a proxy-safe normal poll cadence and retain the existing finite operation deadline.

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
