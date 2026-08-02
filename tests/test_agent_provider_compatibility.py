"""Provider-facing schema regressions for the typed agent contract."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from careertwin.agent.contracts import AgentContext, AgentDraft
from careertwin.agent.providers import OllamaProvider


def test_agent_answer_is_runtime_bounded_without_large_grammar_repetition() -> None:
    """Preserve the output bound without sending Ollama an unsafe repetition range."""
    answer_schema = AgentDraft.model_json_schema()["properties"]["answer"]
    assert answer_schema["minLength"] == 1
    assert "maxLength" not in answer_schema

    with pytest.raises(ValidationError, match="at most 20000 characters"):
        AgentDraft(answer="x" * 20_001, specialist="guide")


def test_ollama_drops_only_ungrounded_write_operations(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Keep a valid answer but never stage local-model writes without citations."""

    class Response:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict[str, object]:
            return {
                "message": {
                    "content": (
                        '{"answer":"Review one goal.","specialist":"guide",'
                        '"citations":[],"proposed_operations":['
                        '{"op":"replace","path":"/headline","value":"Unverified"}]}'
                    )
                }
            }

    monkeypatch.setattr(
        "careertwin.agent.providers.httpx.post", lambda *args, **kwargs: Response()
    )
    provider = OllamaProvider("http://ollama", "synthetic", 10, 4096, 256)

    draft = provider.complete(AgentContext(question="Help me improve"), "guide")

    assert draft.answer == "Review one goal."
    assert draft.proposed_operations == []


def test_ollama_retries_one_truncated_structured_response(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Request one bounded correction, then validate the replacement from scratch."""
    contents = iter(
        (
            '{"answer":"truncated',
            (
                '{"answer":"Review one goal.","specialist":"guide",'
                '"citations":[],"proposed_operations":[]}'
            ),
        )
    )
    calls: list[dict[str, object]] = []

    class Response:
        def __init__(self, content: str) -> None:
            self.content = content

        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict[str, object]:
            return {"message": {"content": self.content}}

    def post(*args: object, **kwargs: object) -> Response:
        calls.append(kwargs["json"])  # type: ignore[arg-type]
        return Response(next(contents))

    monkeypatch.setattr("careertwin.agent.providers.httpx.post", post)
    provider = OllamaProvider("http://ollama", "synthetic", 10, 4096, 1024)

    draft = provider.complete(AgentContext(question="Help me improve"), "guide")

    assert draft.answer == "Review one goal."
    assert len(calls) == 2
    assert calls[1]["options"]["num_predict"] == 512  # type: ignore[index]
