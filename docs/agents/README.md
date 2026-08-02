# Agent harness

## Boundary

Agents extract, draft, explain, and propose. Deterministic application services authenticate, authorize, validate, version, audit, and write. Provider output is never trusted as a database command.

## Turn lifecycle

1. Persist the visible user message in a tenant conversation.
2. Build bounded context from at most 100 confirmed claims plus an optional latest match.
3. Route to `profile`, `opportunity`, `matching`, `improvement`, `pipeline`, or `guide` using an explicit vocabulary.
4. Invoke the selected provider through a typed `AgentContext`/`AgentDraft` contract.
5. Run an evidence critic: all citation IDs must exist in supplied evidence; proposed operations require citations.
6. Persist visible answer, citations, provider, specialist, and durable `AgentRun` state. No hidden chain of thought is stored or exposed. Queued runs commit before ARQ submission and can be polled, cancelled at durable boundaries, or retried as a new lineage-preserving attempt.
7. If operations exist, create a `ProposedChange`. Only a later explicit decision can apply allowlisted profile paths.

## Providers

`mock` provides offline deterministic behavior for tests. xAI/Grok, OpenAI, Anthropic, and Google are Pydantic AI adapters; Ollama uses a bounded structured-output adapter. Keys are optional, environment-only, and never returned by `/api/agent/providers`. The selected provider receives career context; operators must document its data-processing terms.

## Threat controls

- Uploaded and captured content is untrusted data, never system instructions.
- No arbitrary URL/tool access is available to the model.
- JSON operations use an allowlist of target, path, and operation.
- A failed evidence critic fails closed.
- Runs record input digest, phase, provider, specialist, error class, attempt/parent lineage, cancellation request, and timestamps.
- ARQ rehydrates the visible user message and confirmed evidence from PostgreSQL under the worker's tenant context; retry never edits the prior terminal run.
- Optional Langfuse observations contain only a hashed subject, input digest, counts, provider/specialist labels, attempt and status. Prompts, evidence bodies, answers, account values and raw workspace IDs are prohibited.

## Evaluation suites

Provider-independent evals must cover routing, citation resolution, unsupported claims, prompt injection in documents/jobs, multilingual input, refusal boundaries, proposed-operation allowlists, tenant isolation, provider outage, and retry/idempotency. Model quality gates must never replace deterministic security tests.
