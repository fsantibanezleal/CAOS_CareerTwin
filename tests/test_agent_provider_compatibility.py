"""Provider-facing regressions for the external-only typed agent contract."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from careertwin.agent.contracts import AgentContext, AgentDraft
from careertwin.agent.providers import ContractTestProvider, PydanticAIProvider, provider_registry
from careertwin.config import Settings


def test_agent_answer_is_runtime_bounded_without_vendor_specific_schema() -> None:
    answer_schema = AgentDraft.model_json_schema()["properties"]["answer"]
    assert answer_schema["minLength"] == 1
    assert "maxLength" not in answer_schema
    with pytest.raises(ValidationError, match="at most 20000 characters"):
        AgentDraft(answer="x" * 20_001, specialist="guide")


def test_contract_provider_reports_zero_usage() -> None:
    assert ContractTestProvider().usage() == {
        "input_tokens": 0,
        "output_tokens": 0,
        "total_tokens": 0,
    }


def test_registry_never_registers_a_local_provider(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("LLM_DEFAULT_PROVIDER", "contract")
    registry = provider_registry(Settings(_env_file=None))
    assert set(registry) == {"contract"}
    assert "ollama" not in registry


def test_external_provider_applies_runtime_and_output_bounds(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Pass explicit cost and duration limits into every managed model request."""
    captured: dict[str, object] = {}

    class Usage:
        input_tokens = 3
        output_tokens = 5
        total_tokens = 8

    class Result:
        output = AgentDraft(answer="Bounded response", specialist="guide")

        @staticmethod
        def usage() -> Usage:
            return Usage()

    class FakeAgent:
        def __init__(self, model: str, **kwargs: object) -> None:
            captured["model"] = model
            captured.update(kwargs)

        @staticmethod
        def run_sync(_: str) -> Result:
            return Result()

    monkeypatch.setattr("careertwin.agent.providers.Agent", FakeAgent)
    provider = PydanticAIProvider("xai", "xai:grok", 17, 1234)
    result = provider.complete(AgentContext(question="Help"), "guide")

    assert result.answer == "Bounded response"
    assert captured["model_settings"] == {"timeout": 17, "max_tokens": 1234}
    assert provider.usage() == {"input_tokens": 3, "output_tokens": 5, "total_tokens": 8}
