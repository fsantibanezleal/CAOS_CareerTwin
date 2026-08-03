# Research synthesis

Research was refreshed on 2026-08-03 from primary product, standards, vendor, and research sources.
Claims are deliberately narrower than marketing language and must be rechecked when providers or
laws change.

## Comparable personal job-search products

[Teal](https://www.tealhq.com/how-it-works) combines a comprehensive base résumé, job bookmarks,
tailored versions, keyword views, tracking, and pattern-oriented career insights.
[Huntr](https://help.huntr.co/en/articles/10477521-what-is-huntr) combines a base/tailored résumé,
job clipper, Kanban tracker, deadlines, follow-ups, contacts, metrics, and application materials.
[Jobscan](https://support.jobscan.co/hc/en-us/articles/42869628183699-What-exactly-is-being-checked-Can-you-rate-my-resume)
compares résumé content with a job description and exposes a match rate driven mainly by skills,
education/title, and keywords.

CareerTwin adopts the useful one-place research workflow but makes different trust decisions:

- atomic source-linked evidence instead of an opaque profile summary;
- proposed/confirmed/rejected facts and change-by-change approval;
- immutable job snapshots and reproducible score inputs;
- eligibility, alignment, evidence coverage, and unresolved bounds shown separately;
- no auto-apply, autofill submission, bulk outreach, predicted callback, or global hireability score;
- public, local-first code and portable data rather than a SaaS-only product boundary;
- professional and opportunity knowledge graphs with machine-readable and visual lenses.

Marketing outcome claims from comparable products are not used as CareerTwin evidence.

## Graph and matching research

Recent candidate/job systems explore knowledge graphs, factor-wise explanations, semantic matching,
and longitudinal career vaults. [JobMatchAI](https://arxiv.org/abs/2603.14558) describes a
knowledge-graph and explainable multi-factor job-matching platform; a
[multi-source résumé-tailoring case study](https://arxiv.org/abs/2605.05257) describes longitudinal
career records and provenance-aware retrieval. These are useful architectural signals, not proof of
CareerTwin effectiveness or fairness.

CareerTwin keeps relational evidence canonical and builds deterministic graphs as projections. It
does not infer fit from a black-box embedding. Matching is a versioned evidence bridge over reviewed
requirements; a semantic model may propose normalization, but cannot decide canonical evidence or
change the score policy.

## Occupational knowledge

[ESCO](https://esco.ec.europa.eu/en/use-esco) provides multilingual linked occupational concepts
and persistent URIs. CareerTwin pins the official downloadable ESCO release, imports concepts and
relations locally, and never sends profile text to a public taxonomy API.
[O*NET](https://www.onetcenter.org/database.html) is retained as English/US-specific enrichment with
release and attribution provenance.

Lexical plus graph-relation retrieval is the default. The former local EmbeddingGemma service was
removed with all local inference. A future external embedding feature requires a separate ADR that
measures retrieval lift, multilingual non-degradation, cost, privacy, retention, dimensions, and
fallback behavior. Canonical taxonomy IDs remain independent of any vector model.

## Managed agents, documents, and voice

[Pydantic AI](https://ai.pydantic.dev/) supplies provider and typed-output contracts;
[LangGraph](https://docs.langchain.com/oss/python/langgraph/overview) supplies explicit bounded
routing concepts. Durable lifecycle state is stored in CareerTwin's database rather than delegated
to a model or broker.

xAI's current primary contracts support the selected integrated path:

- [Grok 4.5](https://docs.x.ai/developers/grok-4-5) supports Responses/Chat APIs and agentic work.
- [Structured outputs](https://docs.x.ai/developers/model-capabilities/text/structured-outputs) support JSON-schema constrained extraction; CareerTwin still revalidates in Pydantic and applies an evidence critic.
- [Image understanding](https://docs.x.ai/developers/model-capabilities/images/understanding) accepts bounded image inputs and recommends non-retained request history.
- [Files lifecycle](https://docs.x.ai/developers/files/managing-files) provides expiration and explicit deletion for transient scanned-PDF processing.
- [Ephemeral tokens](https://docs.x.ai/developers/model-capabilities/audio/ephemeral-tokens) keep the long-lived key off browser/mobile clients for [Realtime Voice](https://docs.x.ai/developers/model-capabilities/audio/voice-agent).

These capabilities justify external-only inference and browser-to-provider audio. They do not relax
consent, citation, deletion, or approval boundaries.

## Personal connectors and security

[Google Calendar scopes](https://developers.google.com/workspace/calendar/api/auth), the
[Gmail thread API](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.threads/get),
and [Microsoft Graph calendar](https://learn.microsoft.com/en-us/graph/api/resources/calendar-overview?view=graph-rest-1.0)
support user-consented organization. CareerTwin has no email-send permission. Browser capture follows
[Chrome Manifest V3](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3),
requires an explicit click, and has no background crawler.

[NIST AI RMF](https://www.nist.gov/itl/ai-risk-management-framework), its
[Generative AI Profile](https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence),
and [EU Regulation 2024/1689](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=celex%3A32024R1689)
motivate transparency, oversight, non-discrimination, provenance, and audit controls in a sensitive
employment-adjacent setting. CareerTwin is candidate-side support and does not make employer decisions.

## Visualization alternatives

[Sigma.js](https://www.sigmajs.org/) plus [Graphology](https://graphology.github.io/) remains the
selected interactive network stack. [Cytoscape.js](https://js.cytoscape.org/) is the leading
alternative if compound/nested taxonomies become a user need. [Apache ECharts](https://echarts.apache.org/en/index.html)
provides modular analytical charts; React Flow is reserved for inspectable architecture/process
diagrams. GPU-scale Cosmos.gl and 3-D force graphs add capacity or decoration but no additional
single-seeker decision, so they remain rejected.

The Atalaya review led directly to multiple analytical lenses rather than visual skins: searchable
node-link neighborhoods, a degree-ranked adjacency matrix, a complete table, stable IDs, typed edges,
legends, accessible adjacent text, bounded payloads, and explicit denominators.

## Modules derived from research

CareerTwin includes encrypted evidence intake/review, professional and opportunity graphs, pinned
taxonomies, external-only typed chat/document/voice, GitHub evidence, immutable artifacts, versioned
opportunities/target sets, deterministic match history, improvement planning, pipeline/contact/
calendar/email context, explicit browser capture, personal process analytics, portable exchange,
account lifecycle administration, backup/restore, redacted observability, native harness/scripts,
and versioned repository skills.
