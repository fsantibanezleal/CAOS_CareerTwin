"""Acceptance tests for the public-alpha completion contracts."""

from __future__ import annotations

import json
from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy import select

from careertwin.api import agent as agent_api
from careertwin.database import SessionLocal
from careertwin.models import AgentRun
from careertwin.services.agent_runs import execute_agent_run
from careertwin.services.tracing import trace_payload
from tests.conftest import create_account, csrf, login


def _opportunity(title: str = "Evidence engineer") -> dict[str, Any]:
    return {
        "title": title,
        "employer": "Synthetic Systems",
        "description": "Build auditable Python services.",
        "industry": "Software",
        "area": "Engineering",
        "seniority": "senior",
        "location": "Remote",
        "remote_mode": "remote",
        "status": "active",
        "requirements": [
            {
                "category": "skill",
                "label": "Python",
                "importance": "required",
                "weight": 1,
                "minimum_level": 0.8,
            }
        ],
    }


def test_profile_interchange_and_json_resume_are_lossless_and_tenant_scoped(
    client: TestClient,
) -> None:
    """Round-trip curated profile evidence without retaining private IDs or crossing tenants."""
    create_account("portable@example.com")
    token = login(client, "portable@example.com")
    profile = client.get("/api/profile").json()
    updated = client.put(
        "/api/profile",
        headers=csrf(token),
        json={
            "headline": "Evidence-first platform engineer",
            "summary": "Builds explainable systems.",
            "location": "Valparaiso",
            "seniority": "senior",
            "years_experience": 9,
            "availability": "30 days",
            "preferences": {"remote": True},
            "links": [{"network": "GitHub", "url": "https://github.com/example"}],
            "revision": profile["revision"],
        },
    )
    assert updated.status_code == 200, updated.text
    claim = client.post(
        "/api/profile/claims",
        headers=csrf(token),
        json={
            "claim_type": "skill",
            "statement": "Delivered production Python systems.",
            "normalized_value": {"skill": "Python"},
            "confidence": 0.9,
        },
    ).json()
    decision = client.post(
        f"/api/profile/claims/{claim['id']}/decision",
        headers=csrf(token),
        json={"decision": "confirmed", "note": "Reviewed"},
    )
    assert decision.status_code == 200, decision.text
    skill = client.post(
        "/api/profile/skills",
        headers=csrf(token),
        json={
            "name": "Python",
            "level": 0.9,
            "years": 8,
            "confidence": 0.9,
            "category": "technical",
            "evidence_ids": [claim["id"]],
        },
    )
    assert skill.status_code == 201, skill.text
    assert (
        client.post(
            "/api/profile/experiences",
            headers=csrf(token),
            json={
                "organization": "Synthetic Systems",
                "role": "Platform engineer",
                "start_date": "2021-01-01",
                "current": True,
                "summary": "Owned reliable APIs.",
                "achievements": [{"statement": "Reduced incidents by 30%."}],
                "skills": ["Python"],
            },
        ).status_code
        == 201
    )
    assert (
        client.post(
            "/api/profile/education",
            headers=csrf(token),
            json={
                "institution": "Example University",
                "credential": "BSc",
                "field": "Computer Science",
                "start_date": "2010-01-01",
                "end_date": "2014-01-01",
                "details": "Synthetic fixture",
            },
        ).status_code
        == 201
    )

    original = client.get("/api/profile/interchange")
    assert original.status_code == 200, original.text
    document = original.json()
    assert "extracted_text" not in json.dumps(document)
    imported = client.post("/api/profile/interchange/import", headers=csrf(token), json=document)
    assert imported.status_code == 200, imported.text
    assert imported.json()["counts"] == {
        "sources": 0,
        "claims": 1,
        "skills": 1,
        "experiences": 1,
        "education": 1,
    }
    after = client.get("/api/profile/interchange").json()
    assert after["profile"] == document["profile"]
    assert [item["statement"] for item in after["claims"]] == [
        "Delivered production Python systems."
    ]
    assert after["skills"][0]["name"] == "Python"
    assert len(after["skills"][0]["evidence_refs"]) == 1

    resume = client.get("/api/profile/json-resume")
    assert resume.status_code == 200, resume.text
    assert resume.json()["basics"]["label"] == "Evidence-first platform engineer"
    assert resume.json()["x-careertwin"]["schema_version"] == "1.0"
    reimport = client.post(
        "/api/profile/json-resume/import", headers=csrf(token), json=resume.json()
    )
    assert reimport.status_code == 200, reimport.text
    assert client.get("/api/profile/skills").json()[0]["evidence_count"] == 1

    create_account("other@example.com")
    client.post("/api/auth/logout", headers=csrf(token))
    other_token = login(client, "other@example.com")
    other_import = client.post(
        "/api/profile/interchange/import", headers=csrf(other_token), json=document
    )
    assert other_import.status_code == 200, other_import.text
    assert client.get("/api/profile").json()["headline"] == "Evidence-first platform engineer"
    client.post("/api/auth/logout", headers=csrf(other_token))
    login(client, "portable@example.com")
    assert len(client.get("/api/profile/skills").json()) == 1


def test_opportunity_history_target_sets_and_editable_readiness_plan(client: TestClient) -> None:
    """Keep immutable job revisions and turn explicit gaps into candidate-owned work."""
    create_account("portfolio@example.com")
    token = login(client, "portfolio@example.com")
    created = client.post("/api/opportunities", headers=csrf(token), json=_opportunity())
    assert created.status_code == 201, created.text
    opportunity = created.json()
    changed = _opportunity("Principal evidence engineer")
    changed["description"] = "Lead auditable Python services."
    updated = client.put(
        f"/api/opportunities/{opportunity['id']}", headers=csrf(token), json=changed
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["version"] == 2
    history = client.get(f"/api/opportunities/{opportunity['id']}/history")
    assert history.status_code == 200, history.text
    assert [item["version"] for item in history.json()] == [2, 1]
    assert history.json()[1]["snapshot"]["title"] == "Evidence engineer"

    target = client.post(
        "/api/opportunities/target-sets",
        headers=csrf(token),
        json={
            "name": "Remote platform roles",
            "description": "A deliberate search scenario",
            "opportunity_ids": [opportunity["id"]],
            "strategy": {"weights": {opportunity["id"]: 2}},
        },
    )
    assert target.status_code == 201, target.text
    target_id = target.json()["id"]
    run = client.post(f"/api/matches/{opportunity['id']}/run", headers=csrf(token))
    assert run.status_code == 201, run.text
    alignment = client.get(f"/api/matches/target-sets/{target_id}/alignment")
    assert alignment.status_code == 200, alignment.text
    assert alignment.json()["matched_count"] == 1
    assert alignment.json()["meaning"].endswith("not hiring probability.")

    generated = client.post(
        f"/api/matches/{opportunity['id']}/recommendations", headers=csrf(token)
    )
    assert generated.status_code == 200, generated.text
    recommendation = generated.json()[0]
    edited = client.patch(
        f"/api/matches/recommendations/{recommendation['id']}",
        headers=csrf(token),
        json={
            "effort": 0.35,
            "status": "doing",
            "prerequisites": ["Choose a course"],
            "steps": [{"title": "Build a cited sample", "done": False}],
            "progress": 0.4,
        },
    )
    assert edited.status_code == 200, edited.text
    assert edited.json()["status"] == "doing"
    assert edited.json()["steps"][0]["title"] == "Build a cited sample"
    task = client.post(
        f"/api/matches/recommendations/{recommendation['id']}/task", headers=csrf(token)
    )
    assert task.status_code == 200, task.text
    assert task.json()["title"] == recommendation["title"]
    matrix = client.get(f"/api/matches/target-sets/{target_id}/recommendations")
    assert matrix.status_code == 200, matrix.text
    assert matrix.json()["denominator"] == 1

    create_account("outsider@example.com")
    client.post("/api/auth/logout", headers=csrf(token))
    outsider_token = login(client, "outsider@example.com")
    rejected = client.post(
        "/api/opportunities/target-sets",
        headers=csrf(outsider_token),
        json={"name": "Invalid", "opportunity_ids": [opportunity["id"]]},
    )
    assert rejected.status_code == 400


def test_contacts_and_calendar_import_are_tenant_safe_and_idempotent(client: TestClient) -> None:
    """Associate meetings with contacts and import RFC 5545 events once per UID."""
    create_account("calendar@example.com")
    token = login(client, "calendar@example.com")
    opportunity = client.post(
        "/api/opportunities", headers=csrf(token), json=_opportunity("Calendar role")
    ).json()
    application = client.post(
        "/api/pipeline/applications",
        headers=csrf(token),
        json={"opportunity_id": opportunity["id"], "channel": "referral", "notes": ""},
    )
    assert application.status_code == 201, application.text
    contact = client.post(
        "/api/pipeline/contacts",
        headers=csrf(token),
        json={
            "application_id": application.json()["id"],
            "name": "Alex Recruiter",
            "email": "alex@example.com",
            "organization": "Synthetic Systems",
            "role": "Recruiter",
        },
    )
    assert contact.status_code == 201, contact.text
    meeting = client.post(
        "/api/pipeline/tasks",
        headers=csrf(token),
        json={
            "application_id": application.json()["id"],
            "contact_id": contact.json()["id"],
            "kind": "meeting",
            "title": "Screening call",
            "starts_at": "2026-08-10T14:00:00Z",
            "due_at": "2026-08-10T14:30:00Z",
        },
    )
    assert meeting.status_code == 201, meeting.text
    calendar = client.get("/api/pipeline/calendar.ics")
    assert calendar.status_code == 200
    assert b"BEGIN:VEVENT" in calendar.content
    first = client.post(
        "/api/pipeline/calendar/import",
        headers=csrf(token),
        files={"file": ("career.ics", calendar.content, "text/calendar")},
    )
    assert first.status_code == 200, first.text
    assert first.json() == {"created": 1, "skipped": 0, "events": 1}
    second = client.post(
        "/api/pipeline/calendar/import",
        headers=csrf(token),
        files={"file": ("career.ics", calendar.content, "text/calendar")},
    )
    assert second.status_code == 200, second.text
    assert second.json() == {"created": 0, "skipped": 1, "events": 1}

    create_account("calendar-outsider@example.com")
    client.post("/api/auth/logout", headers=csrf(token))
    outsider = login(client, "calendar-outsider@example.com")
    rejected = client.post(
        "/api/pipeline/tasks",
        headers=csrf(outsider),
        json={
            "contact_id": contact.json()["id"],
            "kind": "meeting",
            "title": "Cross-tenant meeting",
        },
    )
    assert rejected.status_code == 400


def test_durable_agent_run_cancel_retry_execution_and_redacted_trace(
    client: TestClient, monkeypatch: Any
) -> None:
    """Persist queue checkpoints, preserve retries and emit metadata-only trace payloads."""
    queued_jobs: list[tuple[str, str]] = []

    async def fake_enqueue(_: object, workspace_id: str, run_id: str) -> None:
        queued_jobs.append((workspace_id, run_id))

    monkeypatch.setattr(agent_api, "_enqueue", fake_enqueue)
    create_account("agent@example.com")
    token = login(client, "agent@example.com")
    queued = client.post(
        "/api/agent/runs",
        headers=csrf(token),
        json={"message": "Summarize only my confirmed evidence.", "provider": "contract"},
    )
    assert queued.status_code == 201, queued.text
    run = queued.json()
    assert run["status"] == "queued"
    assert len(queued_jobs) == 1
    cancelled = client.post(f"/api/agent/runs/{run['id']}/cancel", headers=csrf(token))
    assert cancelled.status_code == 200, cancelled.text
    assert cancelled.json()["status"] == "cancelled"
    retried = client.post(f"/api/agent/runs/{run['id']}/retry", headers=csrf(token))
    assert retried.status_code == 201, retried.text
    retry = retried.json()
    assert retry["parent_run_id"] == run["id"]
    assert retry["attempt"] == 2

    with SessionLocal() as db:
        stored = db.scalar(select(AgentRun).where(AgentRun.id == retry["id"]))
        assert stored is not None
        workspace_id = stored.workspace_id
    result = execute_agent_run(workspace_id, retry["id"])
    assert result["status"] == "completed"
    completed = client.get(f"/api/agent/runs/{retry['id']}")
    assert completed.status_code == 200, completed.text
    assert completed.json()["status"] == "completed"
    messages = client.get(
        f"/api/agent/conversations/{completed.json()['conversation_id']}/messages"
    )
    assert messages.status_code == 200, messages.text
    assert [item["role"] for item in messages.json()] == ["user", "assistant"]

    payload = trace_payload(
        run_id=retry["id"],
        workspace_id=workspace_id,
        provider="contract",
        specialist="profile_coach",
        status="completed",
        input_digest="0" * 64,
        evidence_count=7,
        citation_count=2,
        attempt=2,
    )
    serialized = json.dumps(payload)
    assert workspace_id not in serialized
    assert retry["id"] not in serialized
    assert "Summarize only my confirmed evidence" not in serialized
    assert payload["metadata"]["contract"] == "redacted-v1"

    create_account("agent-outsider@example.com")
    client.post("/api/auth/logout", headers=csrf(token))
    login(client, "agent-outsider@example.com")
    assert client.get(f"/api/agent/runs/{retry['id']}").status_code == 404
