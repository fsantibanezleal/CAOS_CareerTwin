# Research synthesis

Research was refreshed on 2026-08-01. Sources are linked directly so decisions can be revalidated as tools, laws, and standards change.

## Comparable products

Teal, Huntr, and Jobscan combine job tracking, résumé tailoring, match/keyword analysis, reminders, and application stages. CareerTwin includes the useful personal workspace pattern but differentiates on public self-hosting, atomic evidence provenance, a professional graph, deterministic/idempotent match runs, eligibility separation, coverage/uncertainty, provider choice, and explicit human approval. It intentionally omits autofill/auto-apply and does not present a marketing “chance” score.

## Taxonomy

[ESCO](https://esco.ec.europa.eu/en/use-esco) is multilingual linked open data with persistent concept URIs and explicit job-matching/career-guidance use cases. CareerTwin pins a local ESCO release and stores taxonomy URIs; it never sends profile text to the public API. [O*NET Web Services](https://services.onetcenter.org/about) provides detailed US occupational data but has attribution, account, and republication conditions, so O*NET remains optional and license-aware.

## Agent and risk guidance

[LangGraph](https://docs.langchain.com/oss/python/langgraph/overview) provides explicit routing, durable execution, and human-in-the-loop primitives. [Pydantic AI](https://ai.pydantic.dev/) provides typed provider/output contracts, while [xAI structured outputs](https://docs.x.ai/developers/model-capabilities/text/structured-outputs) supports schema-constrained extraction. CareerTwin still places canonical writes outside the model graph.

[NIST AI RMF](https://www.nist.gov/itl/ai-risk-management-framework) and its [Generative AI Profile](https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence) motivate governed, measured, documented risk controls. [EU Regulation 2024/1689](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=celex%3A32024R1689) identifies employment/recruitment AI as a sensitive/high-risk setting; CareerTwin is candidate-side decision support, but adopts non-discrimination, transparency, oversight, and audit boundaries.

## Data/security/visual foundations

- [PostgreSQL row security](https://www.postgresql.org/docs/17/ddl-rowsecurity.html) supplies database-enforced tenant policies.
- [pgvector](https://github.com/pgvector/pgvector) keeps optional semantic retrieval beside canonical relational data.
- [GitHub fine-grained token guidance](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens) supports minimal repository selection and permissions.
- [Sigma.js](https://www.sigmajs.org/) and Graphology support interactive graph projections; [Apache ECharts](https://echarts.apache.org/en/index.html) supplies modular analytical charts; React Flow supplies inspectable architecture views.
- OWASP guidance for LLM/prompt-injection and SSRF/upload defenses informs fail-closed parsing, URL validation, bounded model context, and approval gates.

## New modules derived from research

Beyond the two initial profile/job modules, the system includes evidence review, taxonomy normalization, provider-safe chat, versioned career artifacts, an opportunity landscape, immutable match history, uncertainty/coverage, improvement planning, pipeline timeline/tasks/calendar, personal funnel analytics, portable export, account lifecycle administration, backup/restore verification, observability, and reusable skills.
