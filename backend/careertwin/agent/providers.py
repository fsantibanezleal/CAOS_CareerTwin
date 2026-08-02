"""Real model-provider registry with typed, evidence-bounded outputs."""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Protocol

import httpx
from pydantic import ValidationError
from pydantic_ai import Agent

from careertwin.agent.contracts import AgentContext, AgentDraft, EvidenceReference
from careertwin.agent.prompts import CAREER_AGENT
from careertwin.config import Settings


class Provider(Protocol):
    name: str

    def complete(self, context: AgentContext, specialist: str) -> AgentDraft:
        """Return a validated visible answer and optional uncommitted operations."""

    def ready(self) -> bool:
        """Return whether the configured provider can accept work without exposing secrets."""


@dataclass
class ContractTestProvider:
    """Deterministic contract double registered only while ``APP_ENV=test``."""

    name: str = "contract"

    def complete(self, context: AgentContext, specialist: str) -> AgentDraft:
        cited = [
            EvidenceReference(
                evidence_id=str(item.get("id", "")),
                label=str(item.get("statement") or item.get("label") or "Evidence"),
            )
            for item in context.evidence[:5]
            if item.get("id")
        ]
        if context.locale == "es":
            answer = (
                "Revisé la evidencia confirmada disponible. "
                f"La consulta fue dirigida al especialista de {specialist}. "
                "Las brechas sin evidencia deben tratarse como desconocidas, no como debilidades."
            )
        else:
            answer = (
                "I reviewed the available confirmed evidence. "
                f"This request was routed to the {specialist} specialist. "
                "Gaps without evidence are treated as unknown, not as weaknesses."
            )
        return AgentDraft(answer=answer, specialist=specialist, citations=cited)

    def ready(self) -> bool:
        """Remain available only inside the isolated test process."""
        return True


class PydanticAIProvider:
    """Thin typed adapter; Pydantic AI owns vendor protocol details and output validation."""

    def __init__(self, name: str, model: str) -> None:
        self.name = name
        self.model = model

    def complete(self, context: AgentContext, specialist: str) -> AgentDraft:
        agent: Agent[None, AgentDraft] = Agent(
            self.model, output_type=AgentDraft, system_prompt=CAREER_AGENT.system
        )
        payload = {"specialist": specialist, **context.model_dump(mode="json")}
        result = agent.run_sync(json.dumps(payload, ensure_ascii=False))
        return result.output

    def ready(self) -> bool:
        """Report configured status; live smoke tests verify vendor credentials at release time."""
        return True


class OllamaProvider:
    """Local structured-output adapter that never sends career evidence off the host."""

    name = "ollama"

    def __init__(
        self,
        base_url: str,
        model: str,
        timeout_seconds: int,
        context_window: int,
        max_output_tokens: int,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout_seconds = timeout_seconds
        self.context_window = context_window
        self.max_output_tokens = max_output_tokens

    def _request(self, messages: list[dict[str, str]], *, num_predict: int) -> str:
        """Request one structured local completion and return its visible content."""
        payload = {
            "model": self.model,
            "stream": False,
            "format": AgentDraft.model_json_schema(),
            "messages": messages,
            "options": {
                "temperature": 0,
                "num_ctx": self.context_window,
                "num_predict": num_predict,
            },
            "keep_alive": "5m",
        }
        response = httpx.post(
            f"{self.base_url}/api/chat", json=payload, timeout=self.timeout_seconds
        )
        response.raise_for_status()
        return str(response.json().get("message", {}).get("content", ""))

    @staticmethod
    def _validated_draft(content: str) -> AgentDraft:
        """Validate output and discard only citation-free speculative writes."""
        try:
            return AgentDraft.model_validate_json(content)
        except ValidationError as validation_error:
            # Small local models sometimes return a useful visible answer together with
            # speculative write operations but no citations. Those operations are never
            # safe to stage. Remove only that ungrounded write surface and then validate
            # every other field normally; malformed answers and citations still fail.
            try:
                candidate = json.loads(content)
            except (json.JSONDecodeError, TypeError):
                raise validation_error from None
            if (
                isinstance(candidate, dict)
                and isinstance(candidate.get("proposed_operations"), list)
                and candidate["proposed_operations"]
                and not candidate.get("citations")
            ):
                candidate["proposed_operations"] = []
                return AgentDraft.model_validate(candidate)
            raise

    def complete(self, context: AgentContext, specialist: str) -> AgentDraft:
        messages = [
            {
                "role": "system",
                "content": CAREER_AGENT.system,
            },
            {
                "role": "user",
                "content": json.dumps(
                    {"specialist": specialist, **context.model_dump(mode="json")},
                    ensure_ascii=False,
                ),
            },
        ]
        content = self._request(messages, num_predict=self.max_output_tokens)
        try:
            return self._validated_draft(content)
        except ValidationError:
            correction = (
                "The previous response was incomplete or invalid. Return exactly one complete "
                "JSON object matching the schema. Keep answer under 800 characters, cite only "
                "evidence IDs supplied by the user, and use proposed_operations=[] unless every "
                "operation is supported by at least one citation."
            )
            repaired = self._request(
                [
                    *messages,
                    {"role": "assistant", "content": content[-8_000:]},
                    {"role": "user", "content": correction},
                ],
                num_predict=min(self.max_output_tokens, 512),
            )
            return self._validated_draft(repaired)

    def ready(self) -> bool:
        """Verify the Ollama daemon and exact configured model are locally available."""
        try:
            response = httpx.get(f"{self.base_url}/api/tags", timeout=3)
            response.raise_for_status()
            names = {str(item.get("name", "")) for item in response.json().get("models", [])}
            return self.model in names or f"{self.model}:latest" in names
        except (httpx.HTTPError, ValueError, TypeError):
            return False


def provider_registry(settings: Settings) -> dict[str, Provider]:
    """Build configured adapters without exposing credentials to application payloads."""
    providers: dict[str, Provider] = {}
    if settings.app_env == "test":
        providers["contract"] = ContractTestProvider()
    if settings.xai_api_key:
        providers["xai"] = PydanticAIProvider("xai", "xai:grok-4")
    if settings.openai_api_key:
        providers["openai"] = PydanticAIProvider("openai", "openai:gpt-5-mini")
    if settings.anthropic_api_key:
        providers["anthropic"] = PydanticAIProvider("anthropic", "anthropic:claude-sonnet-4-0")
    if settings.google_api_key:
        providers["google"] = PydanticAIProvider("google", "google-gla:gemini-2.5-flash")
    if settings.ollama_base_url:
        providers["ollama"] = OllamaProvider(
            settings.ollama_base_url,
            settings.ollama_model,
            settings.llm_request_timeout_seconds,
            settings.llm_context_window,
            settings.llm_max_output_tokens,
        )
    return providers
