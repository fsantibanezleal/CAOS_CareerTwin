# Agent harness

Agents extract, draft, explain, and propose. Deterministic application services authenticate,
authorize, validate, version, audit, and write. Provider output is never a database command.

## External-only provider boundary

Runtime providers are xAI/Grok, OpenAI, Anthropic, and Google when their environment-only key is
configured. There is no Ollama adapter or local model fallback. `GET /api/agent/providers` exposes
configured names, selected default, `external-only` mode, and Grok Voice availability without keys.

The deterministic core does not require a model. Text/DOCX/PDF/HTML extraction and conservative
proposal generation still work with no provider. Chat fails clearly until a real external provider
is configured.

## Durable turn lifecycle

1. Persist the visible user message and queued `AgentRun` in the tenant database.
2. Let the worker atomically claim the row; Redis/ARQ is not involved.
3. Build bounded context from confirmed claims plus an optional latest match.
4. Route to profile, opportunity, matching, improvement, pipeline, or guide using an explicit vocabulary.
5. Invoke the selected managed provider through `AgentContext`/`AgentDraft`.
6. Reject citations outside supplied evidence and reject proposed operations without citations.
7. Persist visible answer, citations, provider, specialist, sanitized usage, and terminal state. Never persist or expose hidden reasoning.
8. Create a `ProposedChange` only for allowlisted operations. Apply it only after a later explicit decision.

Cancel and terminal transitions lock the row. Retry creates a lineage-preserving child attempt. A
worker restart returns stale pre-provider claims to the queue; an interrupted in-flight provider
call fails with a sanitized interruption state instead of being duplicated silently.

## Native skill path

`scripts/career.ps1 chat "question"` and `scripts/career.sh chat "question"` authenticate through a
hidden password prompt, create a durable run, poll it, and return visible messages/citations as JSON.
The generic harness supports all other tenant-scoped API operations while accepting only relative
`/api/...` paths and retaining cookie/CSRF state in memory.

## Grok Voice

The authenticated web app requests a five-minute xAI Realtime client secret from CareerTwin. The
browser then streams microphone/audio directly to `wss://api.x.ai/v1/realtime` using the ephemeral
credential. The long-lived `XAI_API_KEY` remains server-side; the VPS does not receive the audio
stream or run an audio model. Voice can explain and converse but cannot bypass canonical-change
approval.

## Privacy and evaluation

Optional Langfuse uses redacted metadata only: hashed run/subject IDs, input digest, counts,
provider/specialist labels, attempt, and status. Prompts, evidence bodies, answers, emails, account
values, credentials, and raw workspace IDs are prohibited.

Evaluation covers routing, citation resolution, unsupported claims, prompt injection, multilingual
input, refusal boundaries, operation allowlists, tenant isolation, provider outage, cancellation,
retry, and interruption recovery. Model quality never replaces deterministic security tests.
