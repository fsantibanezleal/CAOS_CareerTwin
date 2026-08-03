"""External-only document intelligence and deterministic fallback contracts."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest

from careertwin.config import Settings
from careertwin.services import ingestion
from careertwin.services.ingestion import extract_document


def test_text_documents_need_no_model_provider() -> None:
    extraction = extract_document(
        b"Python platform engineering and research leadership",
        "text/plain",
        "resume.txt",
        Settings(_env_file=None),
    )
    assert extraction.engine == "deterministic-structured-text"
    assert "Python platform" in extraction.text


def test_images_fail_clearly_without_external_xai() -> None:
    with pytest.raises(ValueError, match="external xAI provider"):
        extract_document(
            b"\x89PNG\r\n\x1a\nsynthetic",
            "image/png",
            "resume.png",
            Settings(_env_file=None),
        )


def test_repository_contains_no_local_model_runtime() -> None:
    root = Path(__file__).parents[1]
    compose = (root / "compose.yaml").read_text(encoding="utf-8").casefold()
    assert "ollama" not in compose
    assert "docling" not in compose
    assert "torch" not in compose


def test_xai_pdf_is_transient_and_deleted(monkeypatch: pytest.MonkeyPatch) -> None:
    """Keep provider-side document retention bounded and clean up immediately after use."""
    requests: list[tuple[str, dict[str, Any]]] = []
    deleted: list[str] = []

    class Response:
        def __init__(self, payload: dict[str, Any]) -> None:
            self.payload = payload

        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict[str, Any]:
            return self.payload

    def fake_post(url: str, **kwargs: Any) -> Response:
        requests.append((url, kwargs))
        if url.endswith("/files"):
            return Response({"id": "file-transient"})
        return Response({"output": [{"content": [{"text": "faithful text"}]}]})

    def fake_delete(url: str, **_: Any) -> Response:
        deleted.append(url)
        return Response({})

    monkeypatch.setattr(ingestion.httpx, "post", fake_post)
    monkeypatch.setattr(ingestion.httpx, "delete", fake_delete)

    result = ingestion._xai_document_text(
        b"%PDF synthetic",
        "application/pdf",
        "resume.pdf",
        Settings(_env_file=None, xai_api_key="unit-test-key"),
    )

    assert result == "faithful text"
    assert requests[0][1]["data"] == {
        "expires_after": '{"anchor":"created_at","seconds":3600}'
    }
    assert requests[1][1]["json"]["store"] is False
    assert deleted == ["https://api.x.ai/v1/files/file-transient"]
