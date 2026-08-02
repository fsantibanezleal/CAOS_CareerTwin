# Research synthesis

Research was refreshed on 2026-08-02. Sources are linked directly so decisions can be revalidated as tools, laws, and standards change.

## Comparable products

Teal, Huntr, and Jobscan combine job tracking, résumé tailoring, match/keyword analysis, reminders, and application stages. CareerTwin includes the useful personal workspace pattern but differentiates on public self-hosting, atomic evidence provenance, a professional graph, deterministic/idempotent match runs, eligibility separation, coverage/uncertainty, provider choice, and explicit human approval. It intentionally omits autofill/auto-apply and does not present a marketing “chance” score.

## Taxonomy

[ESCO](https://esco.ec.europa.eu/en/use-esco) is multilingual linked open data with persistent concept URIs and explicit job-matching/career-guidance use cases. CareerTwin pins [ESCO 1.2.1 downloadable data](https://esco.ec.europa.eu/en/structure-esco-downloadable-datasets), imports concepts and relations locally, and never sends profile text to a public taxonomy API. The official [O*NET database](https://www.onetcenter.org/database.html) is pinned at 30.3 as an English, US-specific, attribution-aware enrichment. Local [EmbeddingGemma](https://ollama.com/library/embeddinggemma) vectors add measured semantic retrieval without replacing canonical identifiers.

[`taxonomy-provenance.md`](taxonomy-provenance.md) records the exact acquisition rules, archive
digest, attribution, consent boundary, and release-change gate.

## Agent and risk guidance

[LangGraph](https://docs.langchain.com/oss/python/langgraph/overview) provides explicit routing, durable execution, and human-in-the-loop primitives. [Pydantic AI](https://ai.pydantic.dev/) provides typed provider/output contracts. Production Compose uses private [Ollama structured outputs](https://docs.ollama.com/capabilities/structured-outputs) with the measured 398 MB multilingual [Qwen2.5 0.5B instruction model](https://ollama.com/library/qwen2.5%3A0.5b-instruct-q4_K_M); optional hosted providers retain the same schema. CareerTwin still places canonical writes outside the model graph.

## Documents and personal connectors

[Docling's REST contract](https://docling-project.github.io/docling/usage/api_server/rest_api/) defines the self-hosted document-conversion boundary. CareerTwin implements the consumed authenticated subset in a private, CPU-only gateway, keeps malware scanning before conversion, and applies a separate exact-quotation evidence critic afterward.

[Google Calendar scopes](https://developers.google.com/workspace/calendar/api/auth), the [Gmail thread API](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.threads/get), and the [Microsoft Graph calendar model](https://learn.microsoft.com/en-us/graph/api/resources/calendar-overview?view=graph-rest-1.0) support user-consented personal organization. The connector deliberately has no email-send scope. The browser capture follows [Chrome Manifest V3](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3), uses an explicit click, and has no background crawler.

[NIST AI RMF](https://www.nist.gov/itl/ai-risk-management-framework) and its [Generative AI Profile](https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence) motivate governed, measured, documented risk controls. [EU Regulation 2024/1689](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=celex%3A32024R1689) identifies employment/recruitment AI as a sensitive/high-risk setting; CareerTwin is candidate-side decision support, but adopts non-discrimination, transparency, oversight, and audit boundaries.

## Data/security/visual foundations

- [PostgreSQL row security](https://www.postgresql.org/docs/17/ddl-rowsecurity.html) supplies database-enforced tenant policies.
- [pgvector](https://github.com/pgvector/pgvector) keeps optional semantic retrieval beside canonical relational data.
- [GitHub fine-grained token guidance](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens) supports minimal repository selection and permissions.
- [Sigma.js](https://www.sigmajs.org/) and Graphology support interactive graph projections; [Apache ECharts](https://echarts.apache.org/en/index.html) supplies modular analytical charts; React Flow supplies inspectable architecture views.
- OWASP guidance for LLM/prompt-injection and SSRF/upload defenses informs fail-closed parsing, URL validation, bounded model context, and approval gates.

## New modules derived from research

Beyond the two initial profile/job modules, the system includes encrypted document intelligence, evidence review and criticism, ESCO/O*NET hybrid taxonomy retrieval, provider-safe chat, STAR and immutable résumé artifacts, an opportunity landscape, immutable match history, uncertainty/coverage, improvement planning, pipeline timeline/tasks/calendar, read-only recruiting-email context, explicit browser capture, personal funnel analytics, portable export, account lifecycle administration, backup/restore verification, observability, and reusable skills.
