# Model providers and Grok

CareerTwin requires a real model provider. Docker Compose runs a private Ollama service, pulls the pinned `OLLAMA_MODEL`, and selects it with `LLM_DEFAULT_PROVIDER=ollama`. The default `qwen2.5:0.5b-instruct-q4_K_M` was selected from a live constrained-CPU benchmark: it preserved schema-constrained output while avoiding the multi-minute timeouts observed with larger local models. `LLM_CONTEXT_WINDOW` and `LLM_MAX_OUTPUT_TOKENS` bound memory and latency. To use a hosted provider instead, inject a correctly scoped key into the ignored local `.env` or VPS secret environment:

- `XAI_API_KEY` for xAI/Grok.
- `OPENAI_API_KEY` for OpenAI.
- `ANTHROPIC_API_KEY` for Anthropic.
- `GOOGLE_API_KEY` for Google.
- `OLLAMA_BASE_URL` and `OLLAMA_MODEL` for a user-operated local endpoint.

Set `LLM_DEFAULT_PROVIDER` to `xai`, `openai`, `anthropic`, `google`, or `ollama`. Production rejects test/mock names and an unconfigured default. Restart app and worker, log in, and inspect `/api/agent/providers`; it returns names only. Readiness checks that the exact Ollama model is present. Run a synthetic evidence-cited chat against every enabled release provider and verify that unsupported citations fail closed.

Provider keys must never be passed in browser JavaScript, repository files, Compose YAML literals, images, logs, issues, or exports. Provider selection changes where the chosen confirmed evidence/context is processed. Document retention/training terms and obtain the seeker's informed choice before sending private content.

Optional Langfuse tracing uses `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, and `LANGFUSE_HOST`. CareerTwin emits only the `redacted-v1` operational contract; never enable application-level prompt/output capture around it. Verify with synthetic sentinel content that the trace contains hashes, counts and lifecycle labels only. Tracing failure is non-fatal and cannot change the stored agent result.
