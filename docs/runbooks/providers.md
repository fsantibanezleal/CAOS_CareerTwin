# Managed model providers and Grok Voice

CareerTwin never hosts model inference. Supported managed providers are xAI, OpenAI, Anthropic, and
Google through one typed contract. Set exactly one selected default and any keys you intentionally
enable in ignored `.env` or deployment secret storage:

- `LLM_DEFAULT_PROVIDER=xai|openai|anthropic|google`
- `XAI_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `GOOGLE_API_KEY`
- Model overrides such as `XAI_MODEL=grok-4.5`
- `LLM_REQUEST_TIMEOUT_SECONDS` and `LLM_MAX_OUTPUT_TOKENS` for provider cost and duration bounds

Do not add Ollama endpoints, local model binaries, model volumes, or silent fallbacks. Production
rejects test/mock providers and an unconfigured default. Restart API and worker after a provider
change, then inspect `GET /api/agent/providers`; it returns names/default/mode only.

## xAI document path

Native parsers handle extractable text. For a PNG/JPEG or scanned PDF, CareerTwin sends content to
xAI only when `XAI_API_KEY` is configured. Images use a non-retained request. PDFs use the private
Files API with a one-hour expiry safety net and immediate best-effort deletion in `finally`.
Extracted output still passes exact-quotation and protected-trait critics and remains proposed.

## Grok Voice path

The authenticated browser requests `POST /api/agent/voice/session`. CareerTwin exchanges the
long-lived server key for a five-minute xAI Realtime client secret and returns it with
`Cache-Control: no-store`. The browser connects directly to xAI with the
`xai-client-secret.<ephemeral>` WebSocket protocol. Never print this response through the generic
harness, log it, or persist it. The VPS does not receive audio or run an audio model.

## Verification

1. Use synthetic confirmed evidence and inspect `/api/agent/providers`.
2. Run `scripts/career.* chat "bounded synthetic question" --provider <name>`.
3. Verify provider name, terminal run state, visible citation IDs, and rejection of unsupported citations.
4. Verify cancellation/retry and worker restart behavior without duplicate canonical writes.
5. For xAI, upload a synthetic scanned document and verify remote deletion is attempted.
6. In the web UI, verify microphone permission, ephemeral voice connection, stop/cleanup, and no key in client logs/network payloads except the short-lived secret response.

Provider keys must never appear in browser bundles, repository files, Compose literals, command
arguments, images, issues, logs, exports, or observability. Document each provider's current data,
retention, training, regional, availability, and cost terms before sending real professional data.

Primary references: [Grok 4.5](https://docs.x.ai/developers/grok-4-5),
[structured outputs](https://docs.x.ai/developers/model-capabilities/text/structured-outputs),
[image understanding](https://docs.x.ai/developers/model-capabilities/images/understanding),
[file lifecycle](https://docs.x.ai/developers/files/managing-files), and
[ephemeral voice tokens](https://docs.x.ai/developers/model-capabilities/audio/ephemeral-tokens).
