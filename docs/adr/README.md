# Architecture decision records

Records are active from the release in which they were accepted unless superseded. A superseding ADR must link the prior record; historical decisions are not rewritten to hide trade-offs.

| ADR | Decision |
|---|---|
| [0001](0001-modular-monolith.md) | Modular monolith with worker seam |
| [0002](0002-postgresql-pgvector.md) | PostgreSQL/pgvector canonical store |
| [0003](0003-single-seeker-tenancy.md) | One seeker per account, application scope plus RLS |
| [0004](0004-invite-auth-sessions.md) | Invite-only Argon2id and opaque sessions |
| [0005](0005-evidence-approval.md) | Atomic claims and human confirmation |
| [0006](0006-deterministic-matching.md) | Versioned deterministic alignment |
| [0007](0007-occupational-taxonomy.md) | Pinned local ESCO, optional O*NET |
| [0008](0008-agent-harness.md) | LangGraph/Pydantic AI bounded harness |
| [0009](0009-provider-secrets.md) | Superseded provider topology; see 0026 |
| [0010](0010-untrusted-ingestion.md) | Quarantine, bounds, SSRF, malware scanning |
| [0011](0011-github-token.md) | Request-memory-only read-only GitHub token |
| [0012](0012-visualization-stack.md) | Sigma, Graphology, ECharts, React Flow |
| [0013](0013-background-work.md) | Superseded Redis/ARQ work seam; see 0026 |
| [0014](0014-versioned-artifacts.md) | Evidence-grounded immutable artifact versions |
| [0015](0015-candidate-pipeline.md) | Candidate-owned state machine and calendar |
| [0016](0016-public-code-private-data.md) | Public code/private runtime boundary |
| [0017](0017-container-vps-operations.md) | Superseded Compose-first topology; see 0026 |
| [0018](0018-responsible-scope.md) | Candidate-side assistance and prohibited automation |
| [0019](0019-runtime-and-dependency-lifecycle.md) | Runtime history; local-model portions superseded by 0026 |
| [0020](0020-portable-profile-and-target-portfolios.md) | Portable profile contracts and explicit target portfolios |
| [0021](0021-durable-agent-runs-and-redacted-observability.md) | Durable agent history; Redis portion superseded by 0026 |
| [0022](0022-release-quality-contracts.md) | Representative-volume and accessibility release gates |
| [0023](0023-encrypted-document-intelligence.md) | Document-intelligence history; runtime superseded by 0026 |
| [0024](0024-consent-bound-personal-connectors.md) | Consent-bound calendar, email, and browser connectors |
| [0025](0025-hybrid-occupational-retrieval.md) | Retrieval history; local embeddings superseded by 0026 |
| [0026](0026-native-first-external-api-repository-product.md) | Native-first repo product, database worker, external AI only |
| [0027](0027-shared-authenticated-workbench-shell.md) | Shared authenticated frame with product-owned controls |
