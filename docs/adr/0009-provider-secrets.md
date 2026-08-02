# ADR 0009: Provider registry with environment-only secrets

- Status: Accepted
- Date: 2026-08-01

## Decision

Support mock, xAI/Grok, OpenAI, Anthropic, Google, and Ollama behind one typed interface. Keys and endpoints come only from runtime environment/secret storage. The browser receives configured provider names, never key material.

## Consequences

Users retain provider choice and offline verification. Operators must evaluate each provider's privacy/cost/retention terms. Provider failure is recorded with sanitized class/error state and cannot fall through to an undisclosed provider automatically.
