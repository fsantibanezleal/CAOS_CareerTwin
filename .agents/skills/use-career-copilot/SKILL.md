---
name: use-career-copilot
description: Run CareerTwin's evidence-grounded text copilot through configured external APIs and use Grok Voice from the authenticated web interface. Use when asking profile, opportunity, match, pipeline, or improvement questions; inspecting provider availability; reviewing citations; or accepting/rejecting proposed changes. Never claim an unconfigured provider works, expose provider credentials, or let a model write canonical data without approval.
---

# Use Career Copilot

Skill contract version: 1.0.0.

## Outcome

Complete one bounded, evidence-cited agent conversation through a managed external provider while keeping canonical career data under human control.

## Workflow

1. Read `Entry_point.md` and `references/agent-contract.md`.
2. Verify runtime and provider state with `scripts/career.ps1 doctor` and `scripts/career.ps1 get /api/agent/providers` (use `.sh` on POSIX). Stop if no requested external provider is configured.
3. Ask a bounded text question with `scripts/career.ps1 chat "<question>" [--provider xai|openai|anthropic|google] [--opportunity-id <id>]`. The harness queues, polls, and returns the visible answer plus evidence citations.
4. Verify each cited evidence ID belongs to the current seeker and actually supports the answer. Treat uncited capability claims as unresolved.
5. Inspect any proposed change. Confirm or reject it explicitly through the web evidence inbox or the proposal decision endpoint; never apply it automatically.
6. Use Grok Voice only from the authenticated web copilot. The browser obtains a five-minute ephemeral credential and streams directly to xAI; the long-lived server key never enters the browser.

## Provider boundary

- CareerTwin supports managed xAI, OpenAI, Anthropic, and Google APIs when their environment-only key is configured.
- xAI is the default intended text/document/voice provider. Voice requires xAI.
- The VPS and local runtime must not run Ollama, Docling, or any other inference model.
- Provider names and availability may be displayed; keys, hidden reasoning, raw prompt contracts, and ephemeral voice secrets must not be logged or committed.
- A deterministic fallback may extract basic evidence/requirements without an LLM, but chat never pretends to work without a configured external provider.

## Completion

Report provider name, run status, specialist, visible answer, citation count, unresolved evidence, and proposal status. Never print API credentials, ephemeral voice values, hidden prompts, or chain-of-thought.
