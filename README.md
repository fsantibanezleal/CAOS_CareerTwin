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
- CV, resume, document, image OCR, manual-profile, GitHub, URL, paste, and job-document ingestion.
- Proposed/confirmed/rejected evidence with exact source locators and a rich professional graph.
- Reviewed opportunity requirements, deterministic versioned matching, separate eligibility, evidence coverage, and uncertainty bounds.
- Evidence-linked recommendations, résumé/cover-letter/interview/follow-up artifacts, and a candidate-owned board, agenda, calendar, and process analytics.
- Bounded LangGraph/Pydantic AI agent routing with mock, xAI/Grok, OpenAI, Anthropic, Google, and Ollama adapters. Agents propose; deterministic services commit only after approval.
- React workbench with Sigma/Graphology, modular ECharts, React Flow architecture diagrams, dark/light themes, English/Spanish chrome, accessible fallbacks, and reduced-motion behavior.
- Docker Compose, VPS-ready persistent services, local PowerShell/POSIX scripts, CI/security gates, and six validated Codex skills.

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

`0.1.0-alpha.1`: feature-complete first public alpha under verification. See `CHANGELOG.md` for release notes and GitHub issues for tracked work.

## License

MIT. See `LICENSE`.
