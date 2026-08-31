"""Behavioral contracts for the live release journey harness."""

from __future__ import annotations

import importlib.util
from pathlib import Path
from types import ModuleType
from typing import Any

import httpx
import pytest


def _load_harness() -> ModuleType:
    path = Path(__file__).resolve().parents[1] / "scripts" / "release-smoke.py"
    spec = importlib.util.spec_from_file_location("careertwin_release_smoke", path)
    if spec is None or spec.loader is None:
        raise RuntimeError("Release smoke harness cannot be loaded")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _response(status: int, payload: dict[str, Any], **headers: str) -> httpx.Response:
    return httpx.Response(
        status,
        json=payload,
        headers=headers,
        request=httpx.Request("GET", "https://careertwin.example/api/run"),
    )


def test_polling_honors_retry_after_for_idempotent_gets(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    harness = _load_harness()
    responses = iter(
        (
            _response(429, {}, **{"Retry-After": "7"}),
            _response(200, {"status": "completed"}),
        )
    )

    class Client:
        def get(self, _path: str) -> httpx.Response:
            return next(responses)

    sleeps: list[float] = []
    monkeypatch.setattr(harness.time, "sleep", sleeps.append)
    result = harness._poll_json(
        Client(), "/api/run", lambda item: item.get("status") == "completed", timeout=30
    )
    assert result == {"status": "completed"}
    assert sleeps == [7.0]


def test_retry_after_fallback_is_bounded() -> None:
    harness = _load_harness()
    response = _response(429, {})
    assert harness._retry_after_seconds(response, 1) == 2.0
    assert harness._retry_after_seconds(response, 20) == 16.0
    oversized = _response(429, {}, **{"Retry-After": "300"})
    assert harness._retry_after_seconds(oversized, 1) == 30.0
