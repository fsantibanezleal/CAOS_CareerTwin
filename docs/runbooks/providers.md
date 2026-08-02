# Model providers and Grok

CareerTwin runs fully with `LLM_DEFAULT_PROVIDER=mock`. To enable a provider, inject exactly one or more keys into the ignored local `.env` or VPS secret environment:

- `XAI_API_KEY` for xAI/Grok.
- `OPENAI_API_KEY` for OpenAI.
- `ANTHROPIC_API_KEY` for Anthropic.
- `GOOGLE_API_KEY` for Google.
- `OLLAMA_BASE_URL` for a user-operated local endpoint.

Set `LLM_DEFAULT_PROVIDER` to `xai`, `openai`, `anthropic`, `google`, `ollama`, or `mock`. Restart app and worker, log in, and inspect `/api/agent/providers`; it returns names only. Run a synthetic evidence-cited chat and verify that unsupported citations fail closed.

Provider keys must never be passed in browser JavaScript, repository files, Compose YAML literals, images, logs, issues, or exports. Provider selection changes where the chosen confirmed evidence/context is processed. Document retention/training terms and obtain the seeker's informed choice before sending private content.

Optional Langfuse tracing uses `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, and `LANGFUSE_HOST`. CareerTwin emits only the `redacted-v1` operational contract; never enable application-level prompt/output capture around it. Verify with synthetic sentinel content that the trace contains hashes, counts and lifecycle labels only. Tracing failure is non-fatal and cannot change the stored agent result.
