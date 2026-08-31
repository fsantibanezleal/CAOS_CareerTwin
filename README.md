# CareerTwin

CareerTwin is an evidence-first career-research system for one professional per account and many
job opportunities. The product is this public repository: domain modules, graph projections,
deterministic matching and recommendations, connectors, external-provider agents, native harness,
versioned Codex skills, web workbench, tests, ADRs, and runbooks.

The repository turns resumes, documents, GitHub evidence, and curated experience into an auditable
professional graph. It captures and versions job requirements, builds an opportunity knowledge
graph, calculates reproducible evidence alignment, and organizes applications, contacts, meetings,
deadlines, and candidate-controlled improvement work.

Personal documents, provider keys, tokens, passwords, account records, databases, exports, and
deployment credentials never belong in Git.

## Core capabilities

- One isolated seeker workspace per account. A superuser manages account lifecycle but cannot browse another person's career content.
- Encrypted document/source storage, native PDF/DOCX/text/HTML extraction, optional external xAI image/scanned-PDF understanding, exact locators, and proposed/confirmed/rejected evidence.
- Professional graph connecting profile, sources, evidence, skills, experience, education, and accomplishments.
- Opportunity graph connecting roles, employers, atomic requirements, industries, seniority, locations, work modes, and target portfolios.
- Guided evidence-to-action workflow plus deterministic network, inspectable adjacency-matrix/table,
  duration timeline, evidence-matrix, ranked landscape, gap-first match, pipeline, agenda, and
  process-analysis views with EN/ES UI coverage, reduced motion, and accessible data fallbacks.
- Public URL, file, paste/manual, browser-capture, GitHub, Google/Microsoft calendar, and read-only recruiting-email connector boundaries.
- Deterministic versioned matching with separate eligibility, coverage, uncertainty, and evidence bridges; scores are never hiring probabilities.
- Evidence-linked readiness plans, STAR accomplishment bank, immutable tailored career artifacts, and candidate-owned pipeline/calendar.
- Typed xAI/Grok, OpenAI, Anthropic, and Google adapters. No local inference service or silent provider fallback. Grok Voice streams browser-to-xAI using a short-lived credential.
- Database-backed source/agent worker with durable queue, poll, cancel, retry, and conservative interruption recovery—no Redis or ARQ.
- Eight validated repository-local Codex skills and a credential-safe local API harness.

## Native quick start

Prerequisites: Python 3.11 or newer, Node.js 24 LTS, and npm 11. Docker is not required.

```powershell
./scripts/setup.ps1
./scripts/bootstrap-superuser.ps1 -Email you@example.com -DisplayName "Your Name"
./scripts/dev.ps1
./scripts/career.ps1 doctor
```

On Linux/macOS use the equivalent `.sh` scripts. Setup creates repo-root `.venv`, installs the
Python dependency contract, runs `npm ci` into ignored `frontend/node_modules`, creates an ignored
local environment, and migrates the ignored SQLite database. Native development starts:

- Web workbench: `http://127.0.0.1:5173`
- API and OpenAPI: `http://127.0.0.1:8000` and `/api/docs`
- Database-backed worker: a separate repo-local Python process

Stop with `scripts/stop.ps1`/`.sh`. Optional Compose packaging is explicit:
`scripts/dev.ps1 -Docker` or `scripts/dev.sh --docker`.

## Use the repository without the web UI

Repository skills call the same authenticated product modules through the local harness:

```powershell
./scripts/career.ps1 profile-graph
./scripts/career.ps1 profile-upload --file .\private\resume.pdf
./scripts/career.ps1 opportunity-graph
./scripts/career.ps1 match <opportunity-id>
./scripts/career.ps1 chat "Which evidence gaps matter for this target?" --provider xai
```

The harness prompts for the password without echo, keeps cookies/CSRF state only in memory, accepts
only relative `/api/...` paths, and prompts separately for memory-only connector tokens.

## External AI configuration

The deterministic core, graphs, pipeline, matching, and basic document parsing work without an LLM.
Chat and richer typed extraction require a managed provider key in ignored `.env` or deployment
secret storage. Set `LLM_DEFAULT_PROVIDER` to `xai`, `openai`, `anthropic`, or `google` and provide
the corresponding key. Grok Voice and image/scanned-PDF understanding require `XAI_API_KEY`.

CareerTwin never runs Ollama, Docling, an embedding server, or an audio model locally or on the VPS.

## Documentation and governance

Read [`Entry_point.md`](Entry_point.md), the [documentation map](docs/README.md), active
[`ADR 0026`](docs/adr/0026-native-first-external-api-repository-product.md), and shared-workbench
[`ADR 0027`](docs/adr/0027-shared-authenticated-workbench-shell.md). The validated product
plan is maintained in the CAOS management repository. Changes follow issue → focused branch →
tests/docs → pull request to `develop` → reviewed deployment.

Version `0.5.3` carries the decision-grade guided experience and accessible dynamic-visualization
contract on refreshed, vulnerability-scanned dependency and container foundations. It keeps the
browser document fixed to the viewport, gives long routes one predictable internal scroller, protects
mobile content from bottom-navigation overlap, and provides a localized keyboard skip link. The
product remains native-first, external-API-only, and built on the public CAOS shared authenticated workbench frame. See
[`CHANGELOG.md`](CHANGELOG.md) for release evidence.

## License

MIT. See [`LICENSE`](LICENSE).
