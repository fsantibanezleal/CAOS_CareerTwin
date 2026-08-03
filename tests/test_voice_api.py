"""Grok Voice uses short-lived browser credentials and never exposes the server API key."""

from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient

from careertwin.api import agent
from careertwin.config import Settings, get_settings
from careertwin.main import app
from tests.conftest import create_account, csrf, login


def test_voice_requires_an_external_xai_key(client: TestClient) -> None:
    create_account("voice-disabled@fasl.work")
    token = login(client, "voice-disabled@fasl.work")

    response = client.post("/api/agent/voice/session", headers=csrf(token))

    assert response.status_code == 503
    assert response.json()["detail"] == "Grok voice is not configured"


def test_security_policy_allows_only_same_origin_to_request_microphone(
    client: TestClient,
) -> None:
    """Keep Grok Voice usable without delegating microphone access cross-origin."""
    response = client.get("/api/health/live")

    assert response.status_code == 200
    assert response.headers["permissions-policy"] == (
        "camera=(), microphone=(self), geolocation=()"
    )


def test_voice_mints_only_a_five_minute_ephemeral_secret(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    create_account("voice-enabled@fasl.work")
    token = login(client, "voice-enabled@fasl.work")
    calls: list[dict[str, Any]] = []

    class Response:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict[str, Any]:
            return {"value": "ephemeral-browser-secret", "expires_at": 2_000_000_000}

    class Client:
        def __init__(self, **_: Any) -> None:
            pass

        async def __aenter__(self) -> Client:
            return self

        async def __aexit__(self, *_: object) -> None:
            return None

        async def post(self, url: str, **kwargs: Any) -> Response:
            calls.append({"url": url, **kwargs})
            return Response()

    settings = Settings(_env_file=None, xai_api_key="long-lived-server-key")
    app.dependency_overrides[get_settings] = lambda: settings
    monkeypatch.setattr(agent.httpx, "AsyncClient", Client)
    try:
        response = client.post("/api/agent/voice/session", headers=csrf(token))
    finally:
        app.dependency_overrides.pop(get_settings, None)

    assert response.status_code == 200
    assert calls == [
        {
            "url": "https://api.x.ai/v1/realtime/client_secrets",
            "headers": {
                "Authorization": "Bearer long-lived-server-key",
                "Content-Type": "application/json",
            },
            "json": {"expires_after": {"seconds": 300}},
        }
    ]
    body = response.json()
    assert body["value"] == "ephemeral-browser-secret"
    assert body["model"] == "grok-voice-latest"
    assert body["websocket_url"].startswith("wss://api.x.ai/v1/realtime?")
    assert "long-lived-server-key" not in response.text
    assert response.headers["cache-control"] == "no-store, private"
