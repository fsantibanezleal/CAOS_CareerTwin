# ADR 0026: Native-first repository product with external AI services

- Status: Accepted for 0.3.0
- Date: 2026-08-03
- Supersedes: [0009](0009-provider-secrets.md), [0013](0013-background-work.md), [0017](0017-container-vps-operations.md), the local-model portions of [0019](0019-runtime-and-dependency-lifecycle.md), [0021](0021-durable-agent-runs-and-redacted-observability.md), [0023](0023-encrypted-document-intelligence.md), and [0025](0025-hybrid-occupational-retrieval.md)

## Context

CareerTwin's product is the public repository: domain modules, evidence and opportunity graphs, deterministic matching, connectors, agent contracts, versioned skills, local harness, tests, and documentation. A hosted web instance is one access surface. It is not the product boundary and must not turn a small VPS into an inference host.

The previous Compose-first topology added Redis/ARQ, Docling/OCR, Ollama generation, and local embeddings. That topology made local use depend on Docker, consumed substantial resident VPS memory, lowered model quality, duplicated PostgreSQL durability, and contradicted the intended external-API boundary.

## Decision

### Repository-native operation

Native operation is the default. `scripts/setup.ps1`/`.sh` creates repo-root `.venv`, installs the pinned Python dependency contract, verifies Node 24 LTS plus npm 11, and runs `npm ci` from `frontend/package-lock.json` into `frontend/node_modules`. It creates only ignored runtime configuration/data and runs Alembic.

`scripts/dev.*` starts FastAPI, the worker, and Vite directly. `scripts/career.*` is the credential-safe automation surface used by repository skills. It accepts only relative `/api/...` routes, retains cookies/CSRF state in memory, reads passwords and connector tokens from hidden prompts or process-only environment, and never writes credentials.

SQLite is the complete native single-user/local persistence profile. PostgreSQL remains the hosted multi-user persistence profile and RLS defense. The relational database is canonical in both profiles.

### Durable work without a broker

Source rows and `AgentRun` rows are the durable queue. The worker atomically claims eligible database rows, exposes pending/processing/claimed/running/retrying/terminal states, and recovers conservatively after interruption. It never silently duplicates an interrupted external-provider call. Redis and ARQ are removed because they add no canonical state required by this workload.

### External-only AI

Runtime inference is provided only through configured managed xAI, OpenAI, Anthropic, or Google APIs. There is no Ollama provider, local model server, embedded model download, or automatic fallback to an undisclosed provider. Agent chat fails clearly when no external provider is configured. Provider keys stay in runtime environment/secret storage and the provider endpoint returns names and availability only.

xAI is the preferred integrated provider: `grok-4.5` for typed career/document work and `grok-voice-latest` for browser voice. The server mints a short-lived Realtime client secret; the browser connects directly to xAI through WebSocket, so the VPS neither receives an audio stream nor executes an audio model. The long-lived xAI key never enters browser code.

### Document intelligence and evidence criticism

PDF text, DOCX, HTML, Markdown, and plain text use bounded native parsers. Images and scanned PDFs require configured xAI image/file understanding; there is no local OCR/model service. xAI file uploads use a one-hour expiry safety net and are deleted immediately in `finally`. Image requests use non-retained request mode. Operator malware scanning remains fail-closed in production.

Typed external extraction is optional enrichment. With no provider, deterministic parsers still produce conservative reviewable proposals with exact line locators. In every mode, the evidence critic rejects unsupported quotations, protected-trait inference, and duplicates. Model output remains proposed until the seeker explicitly confirms it.

### Graph-centered product surfaces

Relational data remains canonical; graphs are deterministic projections with stable typed IDs and evidence-bearing edges. The professional graph connects profile, sources, claims, skills, experience, education, and accomplishments. The opportunity graph connects roles, employers, requirements, industry, seniority, location, work mode, and target sets. Both expose machine-readable API/harness data and interactive network, adjacency-matrix, table, facets, and inspectors in the web app.

Matching and recommendations remain deterministic/versioned and never become hiring probabilities. Occupational retrieval defaults to local lexical plus graph relations over pinned ESCO/O*NET releases; local embeddings are removed. A future external embedding option requires a separate privacy, cost, benchmark, and retention decision.

### Optional hosted packaging

Docker Compose is an explicit optional packaging/deployment profile, not a local prerequisite. The hosted topology is limited to TLS proxy, app, database-backed worker, PostgreSQL, encrypted blobs, and required malware scanning. No inference, OCR, embedding, Redis, or Docling service runs on the VPS.

## Consequences

- A clone can run the full core product with Python, Node, and SQLite; AI features activate only when the user supplies a managed-provider key outside Git.
- The VPS has fewer services and substantially lower idle memory/CPU demand. External provider cost, privacy, availability, and retention terms become explicit operator/user choices.
- Deterministic extraction remains useful offline but is intentionally conservative. Image/scanned-document understanding and chat are unavailable until xAI is configured.
- Database polling is appropriate for this personal-workspace workload. A future throughput increase must be measured before introducing a broker.
- Historical ADRs remain as evidence of the earlier topology; this record is the active authority when they conflict.

## Primary references

- [xAI Grok 4.5](https://docs.x.ai/developers/grok-4-5)
- [xAI structured outputs](https://docs.x.ai/developers/model-capabilities/text/structured-outputs)
- [xAI image understanding](https://docs.x.ai/developers/model-capabilities/images/understanding)
- [xAI Files API lifecycle](https://docs.x.ai/developers/files/managing-files)
- [xAI ephemeral voice tokens](https://docs.x.ai/developers/model-capabilities/audio/ephemeral-tokens)
- [xAI Voice Agent API](https://docs.x.ai/developers/model-capabilities/audio/voice-agent)
- [Node.js release status](https://nodejs.org/en/about/previous-releases)
