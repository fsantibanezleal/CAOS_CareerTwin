"""SSRF, upload, redaction, agent approval and export security contracts."""

from __future__ import annotations

from fastapi.testclient import TestClient

from careertwin.services.audit import redact
from careertwin.services.ingestion import inspect_content
from careertwin.services.opportunity_ingestion import UnsafeUrlError, validate_public_url
from tests.conftest import create_account, csrf, login


def test_local_and_private_urls_are_rejected() -> None:
    for url in (
        "http://localhost/internal",
        "http://127.0.0.1/metadata",
        "http://169.254.169.254/latest/meta-data",
        "file:///etc/passwd",
    ):
        try:
            validate_public_url(url)
        except UnsafeUrlError:
            pass
        else:
            raise AssertionError(f"unsafe URL accepted: {url}")


def test_mismatched_and_binary_uploads_are_rejected() -> None:
    mismatch = inspect_content(b"%PDF-1.7\n", "text/plain", "resume.txt")
    assert not mismatch.safe
    binary = inspect_content(b"MZ\x00\x01", "application/octet-stream", "resume.exe")
    assert not binary.safe


def test_structural_redaction_removes_nested_secrets() -> None:
    value = redact(
        {
            "github_token": "sentinel-token-value",
            "nested": {"Authorization": "Bearer sentinel-token-value"},
            "safe": "visible",
        }
    )
    encoded = str(value)
    assert "sentinel-token-value" not in encoded
    assert value["safe"] == "visible"


def test_mock_agent_cites_only_confirmed_evidence_and_makes_no_write(client: TestClient) -> None:
    create_account("agent@example.com")
    token = login(client, "agent@example.com")
    before = client.get("/api/profile").json()
    response = client.post(
        "/api/agent/chat",
        headers=csrf(token),
        json={"message": "How can I improve my profile?", "provider": "mock"},
    )
    assert response.status_code == 200, response.text
    assert response.json()["provider"] == "mock"
    assert response.json()["proposed_change_id"] is None
    assert client.get("/api/profile").json() == before


def test_export_excludes_storage_paths_and_extracted_text(client: TestClient) -> None:
    create_account("export@example.com")
    token = login(client, "export@example.com")
    response = client.get("/api/workspace/export", headers=csrf(token))
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"
    assert b"storage_key" not in response.content
    assert b"extracted_text" not in response.content
