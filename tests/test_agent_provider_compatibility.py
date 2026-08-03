"""Provider-facing regressions for the external-only typed agent contract."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from careertwin.agent.contracts import AgentDraft
from careertwin.agent.providers import ContractTestProvider, provider_registry
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
