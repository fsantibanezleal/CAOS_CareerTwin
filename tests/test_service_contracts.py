"""Focused contracts for storage, extraction, taxonomy, connectors, and agent approval."""

from __future__ import annotations

import io
import zipfile
from pathlib import Path
from typing import Any

import httpx
import pytest
from docx import Document
from fastapi.testclient import TestClient
from sqlalchemy import select

from careertwin.database import SessionLocal
from careertwin.models import ProposedChange, User
from careertwin.services import github_connector
from careertwin.services.blob import FileBlobStore
from careertwin.services.github_connector import GithubConnectorError, snapshot_github
from careertwin.services.ingestion import extract_text, inspect_content, propose_profile_claims
from careertwin.services.normalization import label_similarity, normalize_label, token_set
from careertwin.services.opportunity_ingestion import (
    _iter_job_postings,
    _parse_datetime,
    propose_requirements,
)
from careertwin.services.recommendations import build_recommendations
from careertwin.services.taxonomy import import_esco
from tests.conftest import create_account, csrf, login


def test_blob_store_is_opaque_idempotent_and_workspace_scoped(tmp_path: Path) -> None:
    store = FileBlobStore(tmp_path / "blobs")
    first = store.put("workspace-a", b"private synthetic bytes")
    second = store.put("workspace-a", b"private synthetic bytes")
    assert first == second
    assert "private" not in first.key
    assert store.read("workspace-a", first.key) == b"private synthetic bytes"
    with pytest.raises(PermissionError):
        store.read("workspace-b", first.key)
    store.delete_workspace("workspace-a")
    assert not (tmp_path / "blobs" / "workspacea").exists()
    store.delete_workspace("workspace-a")


def test_text_docx_html_inspection_and_conservative_proposals() -> None:
    assert inspect_content(b"plain text", "text/plain", "profile.txt").safe
    html = b"<html><body><h1>Engineer</h1><p>Python skill and research.</p></body></html>"
    assert inspect_content(html, "text/html", "profile.html").safe
    assert "Python skill" in extract_text(html, "text/html")
    document = Document()
    document.add_paragraph("Developed Python services")
    buffer = io.BytesIO()
    document.save(buffer)
    docx = buffer.getvalue()
    inspection = inspect_content(
        docx,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "profile.docx",
    )
    assert inspection.safe
    assert extract_text(docx, inspection.media_type) == "Developed Python services"
    assert not inspect_content(b"PK\x03\x04not-a-zip", "application/octet-stream", "x.docx").safe
    with pytest.raises(ValueError, match="No extractable text"):
        extract_text(b"   \n", "text/plain")
    proposals = propose_profile_claims(
        "Short\nDeveloped Python and SQL services\nExperienced engineering leader", "source-1"
    )
    assert [item["claim_type"] for item in proposals] == ["skill", "experience"]
    assert proposals[0]["source_locator"] == {"line_start": 2, "line_end": 2}


def test_requirement_normalization_and_recommendation_priorities() -> None:
    requirements = propose_requirements(
        "Python knowledge is required. Three years experience is preferred. Friendly team."
    )
    assert [item["category"] for item in requirements] == ["skill", "experience"]
    assert requirements[0]["importance"] == "required"
    actions = build_recommendations(
        [
            {"requirement_id": "met", "label": "Already met", "status": "met", "importance": "required", "category": "skill"},
            {"requirement_id": "unknown", "label": "Leadership", "status": "unknown", "importance": "required", "category": "experience"},
            {"requirement_id": "missing", "label": "Kubernetes", "status": "missing", "importance": "required", "category": "skill"},
            {"requirement_id": "partial", "label": "Communication", "status": "partial", "importance": "preferred", "category": "experience"},
        ]
    )
    assert {item["kind"] for item in actions} == {"evidence", "capability", "presentation"}
    assert actions == sorted(actions, key=lambda item: (-item["priority"], item["title"]))
    assert normalize_label("  Gestión + C#  ") == "gestion + c#"
    assert token_set("AI and SQL") == {"ai", "and", "sql"}
    assert label_similarity("Python API", "Python API") == 1
    assert label_similarity("", "Python") == 0
    assert label_similarity("Python SQL", "Python Rust") == pytest.approx(1 / 3)


def test_jobposting_helpers_are_bounded_and_recursive() -> None:
    data = {
        "@graph": [
            {"@type": "Thing", "name": "ignored"},
            {"@type": "JobPosting", "title": "Synthetic role"},
        ]
    }
    assert _iter_job_postings(data)[0]["title"] == "Synthetic role"
    assert _iter_job_postings("not structured") == []
    assert _parse_datetime("2026-08-01T10:00:00Z") is not None
    assert _parse_datetime("not-a-date") is None
    assert _parse_datetime(None) is None


def test_pinned_esco_import_and_search_endpoints(client: TestClient, tmp_path: Path) -> None:
    archive = tmp_path / "esco.zip"
    with zipfile.ZipFile(archive, "w") as bundle:
        bundle.writestr(
            "skills_en.csv",
            "conceptUri,preferredLabel,altLabels,description\n"
            'https://data.europa.eu/esco/skill/python,Python programming,"Python\nPy",Develop software in Python\n',
        )
        bundle.writestr(
            "occupations_en.csv",
            "conceptUri,preferredLabel,altLabels,description\n"
            "https://data.europa.eu/esco/occupation/engineer,Software engineer,,Build software\n",
        )
    with SessionLocal.begin() as db:
        assert import_esco(db, archive, "en", replace=True) == 2
    create_account("taxonomy@example.com")
    login(client, "taxonomy@example.com")
    status = client.get("/api/taxonomy/status").json()
    assert status["release"] == "1.2.1"
    assert status["counts"]["en"] == 2
    results = client.get("/api/taxonomy/search?q=Python&language=en&concept_type=skill").json()
    assert results[0]["preferred_label"] == "Python programming"
    assert results[0]["similarity"] > 0


class FakeResponse:
    def __init__(self, payload: Any, headers: dict[str, str] | None = None, success: bool = True):
        self.payload = payload
        self.headers = headers or {}
        self.is_success = success

    def json(self) -> Any:
        return self.payload

    def raise_for_status(self) -> None:
        return None


class FakeGithubClient:
    def __init__(self, **_: Any) -> None:
        pass

    def __enter__(self) -> FakeGithubClient:
        return self

    def __exit__(self, *_: object) -> None:
        return None

    def get(self, path: str, **_: Any) -> FakeResponse:
        if path == "/user":
            return FakeResponse(
                {"login": "synthetic"},
                {"x-ratelimit-limit": "5000", "x-ratelimit-remaining": "4999"},
            )
        if path == "/user/repos":
            return FakeResponse([{"full_name": "synthetic/project"}])
        if path.endswith("/languages"):
            return FakeResponse({"Python": 1200, "TypeScript": 600})
        if path.endswith("/releases"):
            return FakeResponse([{"tag_name": "v1.0.0", "published_at": "2026-01-01"}])
        return FakeResponse(
            {
                "full_name": "synthetic/project",
                "description": "Synthetic portfolio fixture",
                "html_url": "https://github.com/synthetic/project",
                "topics": ["career"],
                "stargazers_count": 2,
                "owner": {"login": "synthetic"},
                "default_branch": "develop",
                "updated_at": "2026-08-01T00:00:00Z",
            }
        )


def test_github_snapshot_discards_invalid_names_and_proposes_owned_skills(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(github_connector.httpx, "Client", FakeGithubClient)
    result = snapshot_github("synthetic-token-that-is-long-enough", ["invalid name", "synthetic/project"])
    assert result["login"] == "synthetic"
    assert len(result["repositories"]) == 1
    assert {item["normalized_value"]["skill"] for item in result["proposed_claims"]} == {"python", "typescript"}
    assert "synthetic-token" not in str(result)


def test_github_snapshot_sanitizes_transport_errors(monkeypatch: pytest.MonkeyPatch) -> None:
    class FailingClient:
        def __init__(self, **_: Any) -> None:
            raise httpx.ConnectError("credential-bearing request omitted")

    monkeypatch.setattr(github_connector.httpx, "Client", FailingClient)
    with pytest.raises(GithubConnectorError, match="could not be reached"):
        snapshot_github("synthetic-token-that-is-long-enough", [])


def test_agent_proposed_change_approval_allowlist_and_rejection(client: TestClient) -> None:
    user_id = create_account("approval@example.com")
    token = login(client, "approval@example.com")
    with SessionLocal.begin() as db:
        user = db.scalar(select(User).where(User.id == user_id))
        assert user is not None
        profile = user.workspace.profile
        approved = ProposedChange(
            workspace_id=user.workspace.id,
            target_type="professional_profile",
            target_id=profile.id,
            operations=[{"op": "replace", "path": "/headline", "value": "Approved headline"}],
            evidence_ids=["synthetic-evidence"],
        )
        rejected = ProposedChange(
            workspace_id=user.workspace.id,
            target_type="professional_profile",
            target_id=profile.id,
            operations=[{"op": "replace", "path": "/summary", "value": "Not applied"}],
            evidence_ids=["synthetic-evidence"],
        )
        invalid = ProposedChange(
            workspace_id=user.workspace.id,
            target_type="professional_profile",
            target_id=profile.id,
            operations=[{"op": "replace", "path": "/workspace_id", "value": "escape"}],
            evidence_ids=["synthetic-evidence"],
        )
        db.add_all([approved, rejected, invalid])
        db.flush()
        approved_id, rejected_id, invalid_id = approved.id, rejected.id, invalid.id
    assert len(client.get("/api/agent/proposed-changes").json()) == 3
    approval = client.post(
        f"/api/agent/proposed-changes/{approved_id}/decision",
        headers=csrf(token),
        json={"decision": "approved"},
    )
    assert approval.status_code == 200, approval.text
    assert client.get("/api/profile").json()["headline"] == "Approved headline"
    assert client.post(
        f"/api/agent/proposed-changes/{approved_id}/decision",
        headers=csrf(token),
        json={"decision": "rejected"},
    ).status_code == 409
    assert client.post(
        f"/api/agent/proposed-changes/{rejected_id}/decision",
        headers=csrf(token),
        json={"decision": "rejected"},
    ).status_code == 200
    assert client.post(
        f"/api/agent/proposed-changes/{invalid_id}/decision",
        headers=csrf(token),
        json={"decision": "approved"},
    ).status_code == 400
