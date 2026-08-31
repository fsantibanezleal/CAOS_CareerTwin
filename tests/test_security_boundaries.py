"""SSRF, upload, redaction, agent approval and export security contracts."""

from __future__ import annotations

import base64
import json
import socket
from pathlib import Path

import pytest
from cryptography.exceptions import InvalidTag
from fastapi.testclient import TestClient

from careertwin.services.audit import redact
from careertwin.services.blob import MAGIC, FileBlobStore
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


def test_dns_results_are_all_required_to_be_public(monkeypatch: pytest.MonkeyPatch) -> None:
    def mixed_resolution(*_args: object, **_kwargs: object) -> list[tuple[object, ...]]:
        return [
            (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("203.0.113.10", 0)),
            (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("127.0.0.1", 0)),
        ]

    monkeypatch.setattr(socket, "getaddrinfo", mixed_resolution)
    try:
        validate_public_url("https://jobs.example.test/opening")
    except UnsafeUrlError:
        pass
    else:
        raise AssertionError("mixed public/private DNS response was accepted")


def test_cross_scheme_standard_port_is_rejected() -> None:
    for url in ("http://example.com:443/job", "https://example.com:80/job"):
        try:
            validate_public_url(url)
        except UnsafeUrlError:
            pass
        else:
            raise AssertionError(f"cross-scheme port was accepted: {url}")


def test_mismatched_and_binary_uploads_are_rejected() -> None:
    mismatch = inspect_content(b"%PDF-1.7\n", "text/plain", "resume.txt")
    assert not mismatch.safe
    binary = inspect_content(b"MZ\x00\x01", "application/octet-stream", "resume.exe")
    assert not binary.safe


def test_blob_store_encrypts_authenticates_and_scopes_content(tmp_path: Path) -> None:
    """Private documents are opaque at rest and cannot cross tenant namespaces."""
    key = base64.urlsafe_b64encode(bytes(range(32))).decode().rstrip("=")
    store = FileBlobStore(tmp_path, key, "test-v1")
    content = b"private professional evidence with a unique sentinel"
    stored = store.put("workspace-a", content)
    on_disk = (tmp_path / stored.key).read_bytes()
    assert on_disk.startswith(MAGIC)
    assert content not in on_disk
    assert store.read("workspace-a", stored.key) == content
    with pytest.raises(PermissionError):
        store.read("workspace-b", stored.key)

    tampered = bytearray(on_disk)
    tampered[-1] ^= 1
    (tmp_path / stored.key).write_bytes(tampered)
    with pytest.raises(InvalidTag):
        store.read("workspace-a", stored.key)


def test_blob_migration_encrypts_legacy_plaintext_without_changing_key(tmp_path: Path) -> None:
    """The deploy-time migration preserves database storage keys while sealing legacy bytes."""
    key = base64.urlsafe_b64encode(bytes(reversed(range(32)))).decode().rstrip("=")
    legacy = FileBlobStore(tmp_path)
    stored = legacy.put("workspace-a", b"legacy private bytes")
    encrypted = FileBlobStore(tmp_path, key, "test-v1")
    assert encrypted.encrypt_existing() == {"migrated": 1, "already_encrypted": 0}
    assert encrypted.read("workspace-a", stored.key) == b"legacy private bytes"
    assert encrypted.encrypt_existing() == {"migrated": 0, "already_encrypted": 1}


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


def test_contract_agent_cites_only_confirmed_evidence_and_makes_no_write(
    client: TestClient,
) -> None:
    create_account("agent@example.com")
    token = login(client, "agent@example.com")
    before = client.get("/api/profile").json()
    response = client.post(
        "/api/agent/chat",
        headers=csrf(token),
        json={"message": "How can I improve my profile?", "provider": "contract"},
    )
    assert response.status_code == 200, response.text
    assert response.json()["provider"] == "contract"
    assert response.json()["proposed_change_id"] is None
    assert client.get("/api/profile").json() == before


def test_oauth_authorization_rejects_external_return_locations(client: TestClient) -> None:
    """Prevent protocol-relative and external URLs from entering persisted OAuth state."""
    create_account("oauth-redirect@example.com")
    token = login(client, "oauth-redirect@example.com")
    response = client.post(
        "/api/connectors/oauth/google/authorize",
        headers=csrf(token),
        json={"services": ["calendar"], "redirect_after": "//attacker.example/path"},
    )
    assert response.status_code == 422


def test_export_excludes_storage_paths_and_extracted_text(client: TestClient) -> None:
    create_account("export@example.com")
    token = login(client, "export@example.com")
    response = client.get("/api/workspace/export", headers=csrf(token))
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"
    assert b"storage_key" not in response.content
    assert b"extracted_text" not in response.content


def test_runtime_topology_contains_no_local_inference_or_document_model() -> None:
    """Keep every language, embedding, vision and speech model outside the VPS topology."""
    repository_root = Path(__file__).parents[1]
    compose = (repository_root / "compose.yaml").read_text()
    forbidden = ("ollama", "qwen", "embeddinggemma", "docling", "torch", "model volume")
    assert all(term not in compose.casefold() for term in forbidden)
    assert not (repository_root / "docker" / "ollama" / "Dockerfile").exists()
    assert not (repository_root / "docker" / "docling" / "Dockerfile").exists()


def test_postgres_image_preserves_verifiable_collation_provenance() -> None:
    """Keep the persistent cluster on glibc with immutable PostgreSQL and pgvector inputs."""
    repository_root = Path(__file__).parents[1]
    dockerfile = (repository_root / "docker" / "postgres" / "Dockerfile").read_text()
    assert (
        "cgr.dev/chainguard/wolfi-base:latest@sha256:"
        "0a8fd427de5882aed77471b0a432c3675eda6b6a0ae952b5d640b46da628cdbe"
        in dockerfile
    )
    assert "17.10-alpine" not in dockerfile
    assert "17.10-bookworm" not in dockerfile
    assert "17.10-trixie" not in dockerfile
    assert "postgresql-17=17.10-r1" in dockerfile
    assert "postgresql-17-oci-entrypoint=17.10-r1" in dockerfile
    assert "glibc-locale-en=2.43-r13" in dockerfile
    assert "gosu=1.19-r14" in dockerfile
    assert "posix-libc-utils-bin=2.43-r13" in dockerfile
    assert "PGVECTOR_COMMIT=8ee86c96f0fd72390f890aa8a336fda6d3ab4c6c" in dockerfile
    assert "PGVECTOR_SHA256=d076a3098010905fd60256649327809651f6288327db6413f0938305f62ea299" in dockerfile
    runtime_stage = dockerfile.split("FROM ${WOLFI_IMAGE}", maxsplit=2)[-1]
    assert "apt-get" not in runtime_stage
    assert "build-essential" not in runtime_stage


def test_container_vex_is_exact_and_evidence_backed() -> None:
    """Permit only the reviewed Wolfi backport while every other High finding remains fatal."""
    repository_root = Path(__file__).parents[1]
    vex_path = repository_root / "security" / "openvex.json"
    vex = json.loads(vex_path.read_text(encoding="utf-8"))
    statement = vex["statements"][0]

    assert statement["vulnerability"]["name"] == "CVE-2026-54876"
    assert statement["status"] == "fixed"
    assert {product["@id"] for product in statement["products"]} == {
        "pkg:apk/wolfi/libcrypto3@3.6.3-r4?arch=x86_64&distro=wolfi-20230201&upstream=openssl",
        "pkg:apk/wolfi/libssl3@3.6.3-r4?arch=x86_64&distro=wolfi-20230201&upstream=openssl",
    }
    assert "155b5fe0f93365e6df1c56ee3606b121080c6c12" in statement["status_notes"]

    workflow = (repository_root / ".github" / "workflows" / "container.yml").read_text()
    assert "severity-cutoff: high" in workflow
    assert "fail-build: true" in workflow
    assert "vex: security/openvex.json" in workflow
