"""Real model-provider registry with typed, evidence-bounded outputs."""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Protocol

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

    def usage(self) -> dict[str, int]:
        """Return bounded token usage from the last completed request."""


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

    def usage(self) -> dict[str, int]:
        """Return deterministic zero usage for the isolated contract double."""
        return {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0}


class PydanticAIProvider:
    """Thin typed adapter; Pydantic AI owns vendor protocol details and output validation."""

    def __init__(self, name: str, model: str) -> None:
        self.name = name
        self.model = model
        self._usage: dict[str, int] = {}

    def complete(self, context: AgentContext, specialist: str) -> AgentDraft:
        agent: Agent[None, AgentDraft] = Agent(
            self.model, output_type=AgentDraft, system_prompt=CAREER_AGENT.system
        )
        payload = {"specialist": specialist, **context.model_dump(mode="json")}
        result = agent.run_sync(json.dumps(payload, ensure_ascii=False))
        usage = result.usage()
        self._usage = {
            "input_tokens": int(usage.input_tokens or 0),
            "output_tokens": int(usage.output_tokens or 0),
            "total_tokens": int(usage.total_tokens or 0),
        }
        return result.output

    def ready(self) -> bool:
        """Report configured status; live smoke tests verify vendor credentials at release time."""
        return True

    def usage(self) -> dict[str, int]:
        """Return token counts without vendor payloads or prompt content."""
        return dict(self._usage)


def provider_registry(settings: Settings) -> dict[str, Provider]:
    """Build configured adapters without exposing credentials to application payloads."""
    providers: dict[str, Provider] = {}
    if settings.app_env == "test":
        providers["contract"] = ContractTestProvider()
    if settings.xai_api_key:
        providers["xai"] = PydanticAIProvider("xai", f"xai:{settings.xai_model}")
    if settings.openai_api_key:
        providers["openai"] = PydanticAIProvider("openai", f"openai:{settings.openai_model}")
    if settings.anthropic_api_key:
        providers["anthropic"] = PydanticAIProvider(
            "anthropic", f"anthropic:{settings.anthropic_model}"
        )
    if settings.google_api_key:
        providers["google"] = PydanticAIProvider(
            "google", f"google-gla:{settings.google_model}"
        )
    return providers
