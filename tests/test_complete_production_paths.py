"""Production-path contracts for encrypted connectors, local models, and durable workers."""

from __future__ import annotations

import asyncio
import base64
import hashlib
import io
import zipfile
from datetime import timedelta
from pathlib import Path
from types import SimpleNamespace
from typing import Any
from urllib.parse import parse_qs, urlsplit

import pytest
from cryptography.exceptions import InvalidTag
from fastapi.testclient import TestClient
from pydantic import SecretStr, ValidationError
from sqlalchemy import select

from careertwin.agent.prompts import CAREER_AGENT, registry_manifest
from careertwin.config import Settings
from careertwin.database import SessionLocal
from careertwin.models import (
    CareerTask,
    EmailThread,
    EvidenceClaim,
    ExternalConnection,
    Source,
    SourceStatus,
    TaxonomyConcept,
    TaxonomyImport,
    TaxonomyRelation,
    User,
    utcnow,
)
from careertwin.services import calendar_connector, email_connector, model_extraction, oauth
from careertwin.services.blob import MAGIC, FileBlobStore, StoredBlob
from careertwin.services.calendar_connector import sync_calendar
from careertwin.services.connector_crypto import open_json, seal_json
from careertwin.services.email_connector import sync_email
from careertwin.services.model_extraction import (
    extract_opportunity_requirements,
    extract_profile_claims,
)
from careertwin.services.oauth import access_token, complete_authorization, start_authorization
from careertwin.services.taxonomy import (
    import_esco_relations,
    import_onet,
    record_taxonomy_import,
    search_concepts,
)
from careertwin.worker import process_source, retention_sweep
from tests.conftest import create_account, csrf, login


def encryption_settings(tmp_path: Path, **overrides: Any) -> Settings:
    """Create settings containing synthetic AES keys and no environment-file inputs."""
    key = base64.urlsafe_b64encode(b"k" * 32).decode().rstrip("=")
    values: dict[str, Any] = {
        "app_env": "development",
        "blob_root": tmp_path / "blobs",
        "blob_encryption_key": SecretStr(key),
        "connector_encryption_key": SecretStr(key),
    }
    values.update(overrides)
    return Settings(_env_file=None, **values)


def test_authenticated_blob_and_connector_encryption_round_trips(tmp_path: Path) -> None:
    settings = encryption_settings(tmp_path)
    key = settings.blob_encryption_key.get_secret_value()  # type: ignore[union-attr]
    store = FileBlobStore(tmp_path / "blobs", key)
    stored = store.put("workspace-a", b"private document")
    path = tmp_path / "blobs" / stored.key
    assert path.read_bytes().startswith(MAGIC)
    assert b"private document" not in path.read_bytes()
    assert store.read("workspace-a", stored.key) == b"private document"
    path.write_bytes(path.read_bytes()[:-1] + bytes([path.read_bytes()[-1] ^ 1]))
    with pytest.raises(InvalidTag):
        store.read("workspace-a", stored.key)

    legacy = FileBlobStore(tmp_path / "legacy")
    plain = legacy.put("workspace-b", b"legacy private document")
    encrypted = FileBlobStore(tmp_path / "legacy", key)
    assert encrypted.encrypt_existing() == {"migrated": 1, "already_encrypted": 0}
    assert encrypted.encrypt_existing() == {"migrated": 0, "already_encrypted": 1}
    assert encrypted.read("workspace-b", plain.key) == b"legacy private document"

    token = seal_json(settings, "workspace-a", "google", "oauth-token", {"refresh": "value"})
    assert "value" not in token
    assert open_json(settings, "workspace-a", "google", "oauth-token", token) == {
        "refresh": "value"
    }
    with pytest.raises(ValueError, match="cannot be decrypted"):
        open_json(settings, "workspace-b", "google", "oauth-token", token)


def test_connector_encryption_rejects_missing_or_malformed_keys(tmp_path: Path) -> None:
    missing = Settings(_env_file=None, connector_encryption_key=None)
    with pytest.raises(ValueError, match="not configured"):
        seal_json(missing, "workspace", "google", "token", {})
    malformed = Settings(_env_file=None, connector_encryption_key=SecretStr("short"))
    with pytest.raises(ValueError, match=r"URL-safe base64|exactly 32 bytes"):
        seal_json(malformed, "workspace", "google", "token", {})
    settings = encryption_settings(tmp_path)
    with pytest.raises(ValueError, match="cannot be decrypted"):
        open_json(settings, "workspace", "google", "token", "not-a-ciphertext")


def test_typed_model_critic_accepts_exact_quotes_and_rejects_inference(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    settings = encryption_settings(tmp_path)
    text = "Built Python services for production.\nManaged a team of five engineers."
    profile_output = {
        "claims": [
            {
                "claim_type": "skill",
                "statement": "Built Python services",
                "source_quote": "Built Python services for production.",
                "normalized_value": {"skill": "Python"},
                "confidence": 0.99,
            },
            {
                "claim_type": "profile",
                "statement": "Age 42",
                "source_quote": "Managed a team of five engineers.",
                "normalized_value": {},
                "confidence": 0.8,
            },
            {
                "claim_type": "achievement",
                "statement": "Invented a platform",
                "source_quote": "quote absent from source",
                "normalized_value": {},
                "confidence": 0.8,
            },
        ]
    }
    monkeypatch.setattr(
        model_extraction,
        "_structured_completion",
        lambda *_args, **_kwargs: __import__("json").dumps(profile_output),
    )
    claims = extract_profile_claims(text, "source-1", settings)
    assert len(claims) == 1
    assert claims[0]["confidence"] == 0.95
    assert claims[0]["source_locator"] == {
        "line_start": 1,
        "line_end": 1,
        "quote": "Built Python services for production.",
    }

    requirement_output = {
        "requirements": [
            {
                "category": "skill",
                "label": "Python services",
                "source_quote": "Built Python services for production.",
                "importance": "required",
                "weight": 1.5,
            },
            {
                "category": "skill",
                "label": "Python services",
                "source_quote": "Built Python services for production.",
                "importance": "preferred",
                "weight": 1,
            },
        ]
    }
    monkeypatch.setattr(
        model_extraction,
        "_structured_completion",
        lambda *_args, **_kwargs: __import__("json").dumps(requirement_output),
    )
    requirements = extract_opportunity_requirements(text, settings)
    assert len(requirements) == 1
    assert requirements[0]["normalized_name"] == "python services"
    assert registry_manifest({CAREER_AGENT.identifier: {"type": "object"}})[0]["digest"] == (
        CAREER_AGENT.digest({"type": "object"})
    )


def test_opportunity_extraction_chunks_long_postings_before_model_calls(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    settings = encryption_settings(tmp_path)
    chunks: list[str] = []

    def complete(
        _settings: Settings,
        _system: str,
        _schema: dict[str, Any],
        payload: dict[str, Any],
    ) -> str:
        chunks.append(str(payload["source_data"]))
        return '{"requirements":[]}'

    monkeypatch.setattr(model_extraction, "_structured_completion", complete)
    text = "\n\n".join(("Python platform role. " * 250) for _ in range(4))
    assert extract_opportunity_requirements(text, settings) == []
    assert len(chunks) >= 2
    assert all(len(chunk) <= 6_000 for chunk in chunks)


def test_production_configuration_rejects_contract_and_missing_private_services(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    base = {
        "APP_ENV": "production",
        "DATABASE_URL": "postgresql+psycopg://user:password@db/careertwin",
        "SECURE_COOKIES": "true",
        "APP_SECRET_KEY": "private-app-secret-value",
        "APP_CSRF_SECRET": "private-csrf-secret-value",
        "ALLOWED_ORIGINS": "https://careertwin.example",
        "LLM_DEFAULT_PROVIDER": "contract",
    }
    for name, value in base.items():
        monkeypatch.setenv(name, value)
    with pytest.raises(ValidationError, match="real model provider"):
        Settings(_env_file=None)
    monkeypatch.setenv("LLM_DEFAULT_PROVIDER", "ollama")
    monkeypatch.setenv("OLLAMA_BASE_URL", "http://ollama:11434")
    with pytest.raises(ValidationError, match="BLOB_ENCRYPTION_KEY"):
        Settings(_env_file=None)


def test_esco_relations_and_onet_import_are_idempotent(tmp_path: Path) -> None:
    esco = tmp_path / "esco.zip"
    with zipfile.ZipFile(esco, "w") as bundle:
        bundle.writestr(
            "broaderRelationsSkillPillar_en.csv",
            "conceptUri,broaderUri\nurn:esco:python,urn:esco:programming\n",
        )
        bundle.writestr(
            "occupationSkillRelations_en.csv",
            "occupationUri,skillUri,relationType\nurn:esco:developer,urn:esco:python,essential\n",
        )
    onet = tmp_path / "onet.zip"
    with zipfile.ZipFile(onet, "w") as bundle:
        bundle.writestr(
            "Occupation Data.txt",
            "O*NET-SOC Code\tTitle\tDescription\n15-1252.00\tSoftware Developers\tDevelop software\n",
        )
        bundle.writestr(
            "Skills.txt",
            "O*NET-SOC Code\tElement ID\tElement Name\tScale ID\tData Value\n"
            "15-1252.00\t2.A.2.a\tProgramming\tIM\t4.5\n",
        )
    with SessionLocal.begin() as db:
        assert import_esco_relations(db, esco, replace=True) == 2
        assert import_esco_relations(db, esco) == 0
        assert import_onet(db, onet, replace=True) == {"concepts": 2, "relations": 1}
        provenance = record_taxonomy_import(
            db,
            onet,
            taxonomy="O*NET",
            release="30.3",
            language="en",
            source_url="https://www.onetcenter.org/dl_files/database/db_30_3_text.zip",
            concept_count=2,
            relation_count=1,
        )
        assert import_onet(db, onet) == {"concepts": 0, "relations": 0}
        repeated = record_taxonomy_import(
            db,
            onet,
            taxonomy="O*NET",
            release="30.3",
            language="en",
            source_url="https://www.onetcenter.org/dl_files/database/db_30_3_text.zip",
            concept_count=0,
            relation_count=0,
        )
        assert repeated.id == provenance.id
        assert repeated.concept_count == 2
        assert repeated.relation_count == 1
        assert repeated.archive_sha256 == hashlib.sha256(onet.read_bytes()).hexdigest()
        found = search_concepts(db, "Programming", "en", "skill", mode="lexical")
        assert found == []  # ESCO is the portable default; O*NET remains an enrichment.
        assert db.scalar(select(TaxonomyRelation).where(TaxonomyRelation.taxonomy == "O*NET"))
        assert db.scalar(select(TaxonomyConcept).where(TaxonomyConcept.taxonomy == "O*NET"))
        assert db.scalar(select(TaxonomyImport).where(TaxonomyImport.taxonomy == "O*NET"))


def _confirmed_claim(client: TestClient, token: str) -> dict[str, Any]:
    claim = client.post(
        "/api/profile/claims",
        headers=csrf(token),
        json={
            "claim_type": "achievement",
            "statement": "Reduced synthetic processing time by 30 percent.",
            "normalized_value": {"metric": "30 percent"},
            "confidence": 0.9,
        },
    ).json()
    client.post(
        f"/api/profile/claims/{claim['id']}/decision",
        headers=csrf(token),
        json={"decision": "confirmed", "note": "Reviewed synthetic evidence"},
    )
    return claim


def test_star_resume_connector_status_and_extension_credential_lifecycle(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    create_account("complete@example.com")
    token = login(client, "complete@example.com")
    claim = _confirmed_claim(client, token)
    assert (
        client.post(
            "/api/artifacts/accomplishments",
            headers=csrf(token),
            json={"title": "Unsupported", "status": "confirmed"},
        ).status_code
        == 400
    )
    story = client.post(
        "/api/artifacts/accomplishments",
        headers=csrf(token),
        json={
            "title": "Faster processing",
            "situation": "A batch was slow.",
            "task": "Improve it.",
            "action": "Profiled and optimized the service.",
            "result": "Reduced processing time by 30 percent.",
            "evidence_ids": [claim["id"]],
            "skills": ["Python"],
            "metrics": [{"name": "reduction", "value": 30}],
            "status": "confirmed",
        },
    )
    assert story.status_code == 201, story.text
    resume = client.post(
        "/api/artifacts/resume-variants",
        headers=csrf(token),
        json={
            "name": "Platform resume",
            "summary": "Evidence-first engineer.",
            "evidence_ids": [claim["id"]],
            "accomplishment_ids": [story.json()["id"]],
        },
    )
    assert resume.status_code == 201, resume.text
    assert "Faster processing" in resume.json()["content"]
    assert client.get("/api/artifacts/resume-variants").json()[0]["version"] == 1

    status_response = client.get("/api/connectors/status")
    assert status_response.status_code == 200
    assert status_response.json()["oauth_providers"] == {"google": False, "microsoft": False}
    issued = client.post(
        "/api/connectors/browser/credentials",
        headers=csrf(token),
        json={"label": "Synthetic browser", "expires_in_days": 30},
    )
    assert issued.status_code == 201, issued.text
    raw = issued.json()["token"]
    assert raw not in str(client.get("/api/connectors/status").json())
    extension = client.get("/api/connectors/browser/extension.zip")
    assert extension.status_code == 200
    with zipfile.ZipFile(io.BytesIO(extension.content)) as bundle:
        assert "manifest.json" in bundle.namelist()

    async def queued(*_: object) -> bool:
        return True

    monkeypatch.setattr("careertwin.api.connectors.enqueue_source", queued)
    monkeypatch.setattr(
        "careertwin.api.connectors.configured_blob_store",
        lambda _settings: SimpleNamespace(
            put=lambda _workspace, content: StoredBlob(
                key="/".join(("synthetic", "blob")),
                sha256=hashlib.sha256(content).hexdigest(),
                size=len(content),
            )
        ),
    )
    captured = client.post(
        "/api/connectors/browser/capture",
        headers={"Authorization": f"Bearer {raw}"},
        json={
            "url": "https://jobs.example/role",
            "title": "Synthetic engineer",
            "content": "Python is required for this synthetic engineering role.",
            "captured_at": "2026-08-02T12:00:00Z",
        },
    )
    assert captured.status_code == 202, captured.text
    assert captured.json()["status"] == "queued"
    assert (
        client.delete(
            f"/api/connectors/browser/credentials/{issued.json()['id']}", headers=csrf(token)
        ).status_code
        == 204
    )
    assert (
        client.post(
            "/api/connectors/browser/capture",
            headers={"Authorization": f"Bearer {raw}"},
            json={
                "url": "https://jobs.example/role",
                "title": "Synthetic",
                "content": "Content",
                "captured_at": "2026-08-02T12:00:00Z",
            },
        ).status_code
        == 401
    )


class Response:
    def __init__(self, payload: dict[str, Any]) -> None:
        self.payload = payload

    def json(self) -> dict[str, Any]:
        return self.payload

    def raise_for_status(self) -> None:
        return None


def test_google_oauth_pkce_completion_and_refresh(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    settings = encryption_settings(
        tmp_path,
        app_public_url="https://careertwin.example",
        google_oauth_client_id="client-id",
        google_oauth_client_secret=SecretStr("-".join(("synthetic", "test", "placeholder"))),
    )
    user_id = create_account("oauth@example.com")
    with SessionLocal.begin() as db:
        user = db.scalar(select(User).where(User.id == user_id))
        assert user is not None
        workspace_id = user.workspace.id
        url = start_authorization(
            db, settings, workspace_id, "google", ["calendar", "email"], "/pipeline"
        )
    query = parse_qs(urlsplit(url).query)
    assert query["code_challenge_method"] == ["S256"]
    assert "calendar.events" in query["scope"][0]

    responses = iter(
        [
            Response(
                {
                    "access_token": "access-one",
                    "refresh_token": "refresh-one",
                    "expires_in": 60,
                    "scope": query["scope"][0],
                }
            ),
            Response({"access_token": "access-two", "expires_in": 3600}),
        ]
    )
    monkeypatch.setattr(oauth.httpx, "post", lambda *args, **kwargs: next(responses))
    monkeypatch.setattr(
        oauth.httpx,
        "get",
        lambda *args, **kwargs: Response(
            {"id": "google-subject", "name": "Synthetic User", "email": "oauth@example.com"}
        ),
    )
    with SessionLocal.begin() as db:
        connection, redirect = complete_authorization(
            db, settings, workspace_id, "google", query["state"][0], "authorization-code"
        )
        assert redirect == "/pipeline"
        assert connection.connection_metadata["services"] == ["calendar", "email"]
        connection.token_expires_at = utcnow() - timedelta(minutes=1)
        assert access_token(db, settings, connection) == "access-two"
        assert "refresh-one" not in connection.encrypted_credentials


class GoogleCalendarClient:
    def __init__(self, **_: Any) -> None:
        self.posted = 0

    def __enter__(self) -> GoogleCalendarClient:
        return self

    def __exit__(self, *_: object) -> None:
        return None

    def post(self, _url: str, **_: Any) -> Response:
        self.posted += 1
        return Response({"id": f"created-{self.posted}"})

    def put(self, _url: str, **_: Any) -> Response:
        return Response({"id": "updated-event"})

    def get(self, _url: str, **_: Any) -> Response:
        return Response(
            {
                "items": [
                    {
                        "id": "external-event",
                        "summary": "External interview",
                        "description": "Discuss the role.",
                        "start": {"dateTime": "2026-08-10T10:00:00Z"},
                        "end": {"dateTime": "2026-08-10T10:30:00Z"},
                        "htmlLink": "https://calendar.example/event",
                    }
                ]
            }
        )


def test_calendar_and_email_sync_create_idempotent_local_records(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    settings = encryption_settings(tmp_path)
    user_id = create_account("sync@example.com")
    with SessionLocal.begin() as db:
        user = db.scalar(select(User).where(User.id == user_id))
        assert user is not None
        workspace_id = user.workspace.id
        connection = ExternalConnection(
            workspace_id=workspace_id,
            provider="google",
            account_subject="subject",
            scopes=[],
            encrypted_credentials="opaque",
            connection_metadata={"services": ["calendar", "email"]},
        )
        db.add(connection)
        db.add(
            CareerTask(
                workspace_id=workspace_id,
                kind="meeting",
                title="Local screening",
                starts_at=utcnow() + timedelta(days=2),
                due_at=utcnow() + timedelta(days=2, minutes=30),
                contact={},
            )
        )
        db.flush()
        connection_id = connection.id
    monkeypatch.setattr(calendar_connector, "access_token", lambda *_: "access")
    monkeypatch.setattr(calendar_connector.httpx, "Client", GoogleCalendarClient)
    with SessionLocal.begin() as db:
        connection = db.scalar(
            select(ExternalConnection).where(ExternalConnection.id == connection_id)
        )
        assert connection is not None
        result = sync_calendar(
            db, settings, connection, calendar_id=None, days_back=30, days_forward=180
        )
        assert result["pushed"] == 1
        assert result["imported"] == 1

    class GmailClient:
        def __init__(self, **_: Any) -> None:
            pass

        def __enter__(self) -> GmailClient:
            return self

        def __exit__(self, *_: object) -> None:
            return None

        def get(self, url: str, **_: Any) -> Response:
            if url.endswith("/threads"):
                return Response({"threads": [{"id": "thread-1"}]})
            encoded = base64.urlsafe_b64encode(b"Please schedule an interview.").decode()
            return Response(
                {
                    "id": "thread-1",
                    "messages": [
                        {
                            "id": "message-1",
                            "internalDate": "1785681600000",
                            "snippet": "Interview",
                            "payload": {
                                "mimeType": "text/plain",
                                "headers": [
                                    {"name": "Subject", "value": "Interview for synthetic role"},
                                    {"name": "From", "value": "Recruiter <recruiter@example.com>"},
                                    {"name": "To", "value": "sync@example.com"},
                                ],
                                "body": {"data": encoded},
                            },
                        }
                    ],
                }
            )

    monkeypatch.setattr(email_connector, "access_token", lambda *_: "access")
    monkeypatch.setattr(email_connector.httpx, "Client", GmailClient)
    with SessionLocal.begin() as db:
        connection = db.scalar(
            select(ExternalConnection).where(ExternalConnection.id == connection_id)
        )
        assert connection is not None
        first = sync_email(
            db,
            settings,
            connection,
            days_back=180,
            max_threads=10,
            create_follow_up_tasks=True,
        )
        second = sync_email(
            db,
            settings,
            connection,
            days_back=180,
            max_threads=10,
            create_follow_up_tasks=True,
        )
        assert first == {
            "provider": "google",
            "created": 1,
            "updated": 0,
            "follow_up_tasks_created": 1,
        }
        assert second["updated"] == 1
        assert second["follow_up_tasks_created"] == 0
        assert db.scalar(select(EmailThread).where(EmailThread.workspace_id == workspace_id))


def test_worker_processes_sources_and_removes_expired_email(tmp_path: Path) -> None:
    user_id = create_account("worker@example.com")
    with SessionLocal.begin() as db:
        user = db.scalar(select(User).where(User.id == user_id))
        assert user is not None
        workspace_id = user.workspace.id
        store = FileBlobStore(Settings().blob_root)
        stored = store.put(workspace_id, b"Developed Python services for production")
        source = Source(
            workspace_id=workspace_id,
            kind="resume",
            label="Synthetic resume",
            status=SourceStatus.PENDING,
            media_type="text/plain",
            storage_key=stored.key,
            sha256=stored.sha256,
            source_metadata={"original_name": "resume.txt"},
        )
        db.add(source)
        db.add(
            EmailThread(
                workspace_id=workspace_id,
                source_digest="0" * 64,
                external_thread_id="expired",
                subject="Expired",
                participants=[],
                messages=[],
                retention_until=utcnow() - timedelta(days=1),
            )
        )
        db.flush()
        source_id = source.id
    result = asyncio.run(process_source({}, workspace_id, source_id))
    assert result["status"] == "ready"
    with SessionLocal() as db:
        assert db.scalar(select(EvidenceClaim).where(EvidenceClaim.source_id == source_id))
    swept = asyncio.run(retention_sweep({}))
    assert swept["expired_email_threads_removed"] == 1
