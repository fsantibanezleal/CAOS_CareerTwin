# ADR 0009: Real provider registry with environment-only secrets

- Status: Superseded by ADR 0026
- Date: 2026-08-01

## Decision

Support xAI/Grok, OpenAI, Anthropic, Google, and Ollama behind one typed interface. The Compose deployment uses self-hosted Ollama as the private default. Production rejects mock/test providers and fails closed when its selected provider is not configured. Keys and endpoints come only from runtime environment/secret storage. The browser receives configured provider names, never key material. A deterministic contract double may exist only in the isolated test environment and is not an operating mode.

## Consequences

Users retain provider choice and private local inference. Operators must evaluate each hosted provider's privacy/cost/retention terms. Provider failure is recorded with sanitized class/error state and cannot fall through to an undisclosed provider automatically. Release verification must execute a real structured-output turn; deterministic test results alone are insufficient.
