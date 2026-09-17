# Changelog

All notable changes follow Keep a Changelog. CareerTwin uses semantic versioning.

## [Unreleased]

## [0.9.0] - 2026-09-17

### Fixed

- Resolve requirements against evidence with containment instead of token Jaccard similarity.
  Jaccard divides by the union of both token sets, so a short requirement label compared against a
  full profile record scored lower the richer that record was. "Engineering degree" peaked at 0.091
  against a genuine B.Sc. in Electronics Engineering and a Ph.D. in Electrical Engineering, under a
  0.40 threshold, and the workbench reported it unresolved. Every requirement expressed as a phrase
  rather than a single term was affected the same way, which is why coverage read as thin evidence
  rather than as a broken metric. Matching policy moves to `match-v1.1.0`.
- Treat abbreviated credentials as words. `normalize_label` keeps periods so that `node.js` and
  `.net` survive, which left `b.sc.` and `ph.d.` matching nothing.
- Drop filler terms before comparing. "experience in leadership" and "experience in cooking" shared
  half their tokens before a single meaningful term was compared.
- Search wider evidence when a requirement's category does not resolve it. Categories are assigned
  heuristically at extraction and are frequently wrong; a degree filed as a skill was searched only
  against the skill list and reported as a gap while the education record sat in the same workspace.
- Repin the PostgreSQL base-image guard, which still asserted package revisions superseded by the
  OpenSSL advisory updates, and record the release in README so the packaging contract holds.

### Added

- `careertwin rematch` recomputes every opportunity's alignment under the current matching
  policy. Runs are immutable and keyed by policy version and input digest, so a policy fix does
  not reinterpret stored runs: it needs new ones, and without this a deployed fix stays invisible
  until each opportunity is re-run by hand from the interface.

### Changed

- Replace the opportunity editor with a brief. The screen opened on a textarea of raw unrendered
  markdown followed by one editable row per requirement, each with an importance dropdown, a
  category dropdown, a text input and a weight spinner: forty-eight form controls for twelve
  requirements, and no statement anywhere about fit. The brief leads with coverage, requirements
  met, gaps and eligibility, shows the compensation band, and presents requirements as a filterable
  status grid that is sized to its container rather than a list that grows the page. Selecting one
  shows the evidence that answers it. The editor keeps every capability it had, behind Edit.
- Name the evidence in an assessment. "Resolved against confirmed profile evidence" became
  "Evidenced by B.Sc. in Electronics Engineering, Universidad de Concepcion".


## [0.8.2] - 2026-09-17

### Fixed

- Self-host Source Serif 4 and Inter. The Google Fonts stylesheet was refused in production by the
  Content-Security-Policy (font-src self), so neither family loaded and the serif display face did not
  render. Both are SIL OFL 1.1; the 14 latin woff2 files are now served from the application origin
  and the CSP is unchanged.

## [0.8.1] - 2026-09-17

### Fixed

- styles.css hard-coded a font stack on :root, overriding --font-ui, so the serif display face never
  applied anywhere.

## [0.8.0] - 2026-09-17

### Changed

- New visual direction: paper and ink instead of navy and neon. Warm #f7f5f2 canvas with ink-black
  text, light by default, Source Serif 4 for display, one restrained ink-blue accent replacing neon
  teal plus violet, tighter radii and a paper-weight shadow. The dark theme is warm charcoal, never
  navy, authored independently.
- Verbatim job postings replace the three-sentence summaries previously stored: 16,035 characters
  across the four cases, against 1,623 before. The salary benchmarks, fit assessments and case
  readmes are filed as sources, roughly 70,000 characters of research now reachable in the app.

## [0.7.1] - 2026-09-17

### Fixed

- Topbar clipped the account name at the viewport edge on every page. It carried a fixed 69px height
  sized for the old 9-11px type and could not contain the new scale; it now grows with its contents.
- Brand subtitle wrapped to two lines after moving from 9px to 13px.

## [0.7.0] - 2026-09-17

### Changed

- Redesign the live stylesheet rather than adding tokens beside it. New font stack with tabular
  figures, a lifted-slate canvas replacing near-black navy, one accent instead of two competing
  saturated hues, contrast raised so every text tier clears AA, and 193 pixel rules migrated onto the
  type scale with nothing rendering below 13px.
- EChart emits selection events, merges option updates so zoom and legend state survive a refresh,
  enables zoom on request, and exposes the canvas as figure or application instead of role=img.

### Added

- Compensation band on the match detail: floor, central range and target ask drawn as three marks,
  with basis, research date, note and source. Opportunity.compensation existed on the model and was
  rendered nowhere.

## [0.6.3] - 2026-09-17

### Fixed

- Career timeline: a bar narrower than its own date label rendered as clipped nonsense, showing "20"
  for a nine-month role and "2" for a five-month one. Spans under 9 percent of the timeline now place
  their dates beside the bar.

## [0.6.2] - 2026-09-17

### Fixed

- Repair `frontend/package-lock.json`, which a string-replace version bump had corrupted: `decimal.js`
  was rewritten to a 10.6.1 tarball that was never published and `@fasl-work/caos-app-shell` to a
  version whose integrity hash no longer matched, so `npm ci` 404d inside the image build and v0.6.1
  could not deploy. Version fields are now edited as JSON.

### Added

- `tests/test_lockfile_integrity.py`: only the two root keys may carry the project version,
  package.json and the lock must agree, and every resolved tarball URL must match its declared version.

## [0.6.1] - 2026-09-17

### Removed

- Force-directed constellation and the two-lane career river. Verified in a browser: the constellation
  drew 109 nodes and 198 links as an unreadable hairball with labels truncated mid-word, and the river
  drew two flat lanes with no label on any bar, collapsing eleven roles into one rectangle.

### Added

- Career timeline where every bar names its role, organisation and dates, sorted most recent first,
  expandable to achievements, filterable by experience or education.
- Competitive research in docs/design/competitive-and-visualization-research.md. No comparable tool
  ships a force-directed network; the category competes on actionable per-requirement gap analysis.

## [0.6.0] - 2026-09-17

### Added

- Design system in `src/tokens.css`, researched and documented in
  `docs/design/design-system.md`: type on a 16px base with a Major Third 1.25 ratio and 4pt baseline
  line heights, spacing on the 8pt grid, radius and elevation steps, semantic colour tokens, and
  independently authored dark and light palettes. Adds a visible focus ring to every interactive
  element, the most common dark-mode accessibility failure being an invisible focus indicator.
- Coverage workbench: requirement rows against opportunity columns with sticky header and first
  column, ranked bars sorted high to low, full-text search, status and importance filters, three sort
  modes and an evidence detail panel opened from any cell.

### Changed

- Raise 185 type rules off an 8px floor; nothing essential now renders below 14px.
- Contain the visualisation stages in the viewport instead of scrolling the shell.

### Removed

- Force-directed network and adjacency matrix as primary surfaces. Node position in a force layout
  carries no meaning, so both signalled "knowledge graph" while answering no question a candidate asks.

## [0.5.12] - 2026-09-17

### Fixed

- Bump every version declaration together. v0.5.11 shipped an image whose
  `careertwin.__version__` still read 0.5.10, so `/api/health/ready` reported the wrong version for
  the running release. `backend/careertwin/__init__.py`, `frontend/package-lock.json` and
  `extension/manifest.json` were missed by that bump.

### Added

- `tests/test_version_consistency.py` asserts that VERSION, the Python package, pyproject, both
  frontend manifests and the extension manifest all agree, that VERSION is bare semver, and that the
  changelog documents the current version. A partial bump now fails the test suite instead of
  reaching production.

## [0.5.11] - 2026-09-17

### Changed

- Refresh the Chainguard python and Wolfi base image digests and re-pin all 22 moved apk packages in
  the database image, including the OpenSSL rebuild from 3.6.4-r0 to 3.6.4-r7. The database Dockerfile
  pins exact package versions alongside the base digest, so a base refresh without a matching re-pin
  fails the build with "unable to select packages".
- Hold the accepted Python runtime line and ranged optional dependency majors in Dependabot, so
  upper-bound widening that is not classified as a semantic major cannot land unreviewed.

### Security

- Document CVE-2026-85091 in zlib as an open, unsuppressed finding. The installed
  1.3.2.1_rc20260601-r0 has no published fix in Wolfi and the Chainguard digest is already newest, so
  the repository policy forbids a VEX statement and openvex.json stays empty.

## [0.5.10] - 2026-08-31

### Fixed

- Prioritize decision-significant graph nodes for always-visible labels so small neighboring nodes
  cannot collide with opportunity titles; all node text remains available through hover, inspector,
  search, matrix, and table views.

## [0.5.9] - 2026-08-31

### Fixed

- Encode the graph-label ellipsis independently of source-file encoding and apply a tighter compact
  label budget plus collision grid, keeping mobile constellations legible without hiding exact text
  from hover, inspector, or table views.

## [0.5.8] - 2026-08-31

### Fixed

- Prevent long evidence labels from colliding across dense Sigma clusters by reserving more label
  space and bounding overview copy while preserving full text in hover, inspector and table paths.

## [0.5.7] - 2026-08-31

### Fixed

- Make Sigma node labels, relationship lines, filtering states, and hover labels readable in both
  workbench themes, including live canvas updates when the seeker changes theme.

## [0.5.6] - 2026-08-31

### Fixed

- Make Sigma network surfaces inherit the active workbench theme instead of showing the renderer's
  default white background inside dark profile and opportunity views.

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
