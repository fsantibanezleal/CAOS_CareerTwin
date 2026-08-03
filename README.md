# CareerTwin

CareerTwin is an evidence-first, self-hostable career intelligence workbench for one professional
per account and many job opportunities. It turns resumes, documents, GitHub evidence and manually
curated experience into an auditable professional graph, then compares that graph with normalized
job requirements using deterministic, versioned scoring.

The public repository contains code, schemas, evaluation cases, documentation and reusable Codex
skills. Personal documents, provider keys, account records and deployment credentials never belong
in Git.

Implementation follows the validated plan in
[`CAOS_MANAGE/plans/career-twin`](https://github.com/fsantibanezleal/CAOS_MANAGE/tree/develop/plans/career-twin).

## What is included

- One private seeker workspace per account, with superuser account administration but no cross-user content browser.
- Encrypted CV, resume, document, private Docling/OCR, manual-profile, GitHub, URL, paste, browser-extension, and job-document ingestion with visible durable progress/retry.
- Proposed/confirmed/rejected evidence with exact source locators and a rich professional graph.
- Reviewed opportunity requirements, deterministic versioned matching, separate eligibility, evidence coverage, and uncertainty bounds.
- Evidence-linked editable recommendations, STAR accomplishment bank, immutable tailored résumés, cover-letter/interview/follow-up artifacts, and a candidate-owned board, contact book, agenda, calendar, and process analytics.
- Lossless CareerTwin profile/evidence portability, JSON Resume exchange, immutable opportunity snapshots, and explicit named target portfolios.
- Bounded LangGraph/Pydantic AI routing with private Ollama as the production default and optional xAI/Grok, OpenAI, Anthropic, and Google adapters, plus durable queue/cancel/retry checkpoints and redacted local traces. Agents propose; deterministic services commit only after approval. A contract double exists only in isolated tests.
- Pinned ESCO 1.2.1 and O*NET 30.3 importers, graph relations, local multilingual embeddings, hybrid retrieval, and an EN/ES non-degradation benchmark.
- Consent-bound Google/Microsoft calendar and read-only recruiting-email synchronization plus a revocable, explicit-action Manifest V3 opportunity-capture extension.
- React workbench with Sigma/Graphology, modular ECharts, React Flow architecture diagrams, dark/light themes, English/Spanish chrome, accessible fallbacks, and reduced-motion behavior.
- Docker Compose, VPS-ready persistent services, local PowerShell/POSIX scripts, CI/security/load/accessibility gates, and seven validated Codex skills.

## Quick start

Prerequisites are Python 3.11+ and Node.js 24 LTS. The Node baseline avoids an upstream React Router security advisory and matches the container and CI runtime.

```powershell
./scripts/setup.ps1
./scripts/bootstrap-superuser.ps1 -Email you@example.com -DisplayName "Your Name"
./scripts/dev.ps1
```

On Linux or macOS use the equivalent `.sh` scripts. The default `dev` path uses Docker Compose and serves `http://localhost:8000`; pass `-Code` on PowerShell or `--code` on POSIX for FastAPI/Vite source mode. See [local development](docs/runbooks/local-development.md).

## Documentation

Start at [`Entry_point.md`](Entry_point.md), then use the [documentation map](docs/README.md). OpenAPI is served at `/api/docs` on a running instance. Architecture, product semantics, research, privacy, threat model, agent contracts, visualization rationale, ADRs, and deployment/backup runbooks are all versioned with the code.

## Status

`0.2.5`: complete self-hosted career-research workflows with real private model/document services, encrypted sources, hybrid taxonomies, career artifacts, consent-bound personal connectors, distroless-compatible backup operations, fail-fast AES-256 key validation, rate-aware production verification, portable PostgreSQL restore checks, and one canonical version across every release surface. See `CHANGELOG.md` for release evidence and GitHub issues for tracked changes.

## License

MIT. See `LICENSE`.
