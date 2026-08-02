"""End-to-end API contracts for the main single-seeker workbench journey."""

from __future__ import annotations

from fastapi.testclient import TestClient

from tests.conftest import create_account, csrf, login


def confirmed_claim(client: TestClient, token: str, statement: str = "Led Python delivery") -> str:
    """Create and confirm one synthetic evidence claim."""
    created = client.post(
        "/api/profile/claims",
        headers=csrf(token),
        json={
            "claim_type": "skill",
            "statement": statement,
            "normalized_value": {"skill": "python"},
            "source_locator": {"kind": "synthetic"},
            "confidence": 0.9,
        },
    )
    assert created.status_code == 201, created.text
    claim_id = created.json()["id"]
    decided = client.post(
        f"/api/profile/claims/{claim_id}/decision",
        headers=csrf(token),
        json={"decision": "confirmed", "note": "Synthetic fixture"},
    )
    assert decided.status_code == 200, decided.text
    return str(claim_id)


def test_profile_crud_document_review_and_graph(client: TestClient) -> None:
    create_account("profile@example.com")
    token = login(client, "profile@example.com")
    initial = client.get("/api/profile").json()
    stale = client.put(
        "/api/profile", headers=csrf(token), json={"revision": initial["revision"] + 1}
    )
    assert stale.status_code == 409
    updated = client.put(
        "/api/profile",
        headers=csrf(token),
        json={
            "revision": initial["revision"],
            "headline": "Evidence-first engineer",
            "summary": "Builds deterministic research software.",
            "location": "Santiago",
            "seniority": "senior",
            "years_experience": 8,
            "availability": "open",
            "preferences": {"remote": True},
            "links": [{"label": "portfolio", "url": "https://example.com"}],
        },
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["revision"] == initial["revision"] + 1

    experience = client.post(
        "/api/profile/experiences",
        headers=csrf(token),
        json={
            "organization": "Synthetic Lab",
            "role": "Principal Engineer",
            "start_date": "2020-01-01",
            "current": True,
            "summary": "Led typed services.",
            "achievements": [{"text": "Reduced defects"}],
            "skills": ["Python"],
        },
    )
    assert experience.status_code == 201, experience.text
    education = client.post(
        "/api/profile/education",
        headers=csrf(token),
        json={
            "institution": "Synthetic University",
            "credential": "MSc",
            "field": "Computer Science",
            "start_date": "2017-01-01",
            "end_date": "2019-12-01",
        },
    )
    assert education.status_code == 201, education.text
    assert len(client.get("/api/profile/experiences").json()) == 1
    assert len(client.get("/api/profile/education").json()) == 1

    upload = client.post(
        "/api/profile/sources/upload",
        headers=csrf(token),
        data={"label": "Synthetic resume"},
        files={
            "file": (
                "resume.txt",
                b"Experienced Python engineer\nLed research management and SQL delivery",
                "text/plain",
            )
        },
    )
    assert upload.status_code == 201, upload.text
    assert upload.json()["status"] == "ready"
    assert len(client.get("/api/profile/sources").json()) == 1
    proposals = client.get("/api/profile/claims?state=proposed").json()
    assert len(proposals) == 2
    rejected = client.post(
        f"/api/profile/claims/{proposals[0]['id']}/decision",
        headers=csrf(token),
        json={"decision": "rejected", "note": "Not sufficiently specific"},
    )
    assert rejected.status_code == 200
    assert (
        client.post(
            f"/api/profile/claims/{proposals[0]['id']}/decision",
            headers=csrf(token),
            json={"decision": "confirmed"},
        ).status_code
        == 409
    )
    claim_id = confirmed_claim(client, token)
    skill = client.post(
        "/api/profile/skills",
        headers=csrf(token),
        json={"name": "Python", "level": 0.85, "years": 6, "confidence": 0.9, "evidence_ids": [claim_id]},
    )
    assert skill.status_code == 201, skill.text
    assert client.post(
        "/api/profile/skills",
        headers=csrf(token),
        json={"name": " python ", "evidence_ids": [claim_id]},
    ).status_code == 409
    graph = client.get("/api/profile/graph").json()
    assert {row["kind"] for row in graph["river"]} == {"experience", "education"}
    assert graph["matrix"][0]["evidence"][0]["id"] == claim_id
    assert client.delete(f"/api/profile/skills/{skill.json()['id']}", headers=csrf(token)).status_code == 204
    assert client.delete(f"/api/profile/experiences/{experience.json()['id']}", headers=csrf(token)).status_code == 204
    assert client.delete(f"/api/profile/education/{education.json()['id']}", headers=csrf(token)).status_code == 204
    assert client.delete("/api/profile/education/missing", headers=csrf(token)).status_code == 404


def test_opportunity_match_recommendation_artifact_and_dashboard(client: TestClient) -> None:
    create_account("journey@example.com")
    token = login(client, "journey@example.com")
    claim_id = confirmed_claim(client, token, "Delivered Python APIs for six years")
    client.post(
        "/api/profile/skills",
        headers=csrf(token),
        json={"name": "Python", "level": 0.9, "years": 6, "confidence": 0.95, "evidence_ids": [claim_id]},
    )
    payload = {
        "title": "Senior Platform Engineer",
        "employer": "Synthetic Systems",
        "description": "Python is required. Kubernetes experience is preferred.",
        "source_kind": "paste",
        "industry": "Software",
        "area": "Platform",
        "seniority": "senior",
        "location": "Remote",
        "remote_mode": "remote",
        "deadline_at": "2026-09-01T00:00:00Z",
        "status": "active",
        "requirements": [
            {"category": "skill", "label": "Python", "importance": "required", "minimum_level": 0.8},
            {"category": "skill", "label": "Kubernetes", "importance": "preferred"},
        ],
    }
    created = client.post("/api/opportunities", headers=csrf(token), json=payload)
    assert created.status_code == 201, created.text
    opportunity_id = created.json()["id"]
    assert client.get(f"/api/opportunities/{opportunity_id}").status_code == 200
    assert len(client.get("/api/opportunities").json()) == 1
    proposals = client.post(
        f"/api/opportunities/{opportunity_id}/propose-requirements", headers=csrf(token)
    )
    assert proposals.status_code == 200
    assert len(proposals.json()) == 2
    payload["title"] = "Principal Platform Engineer"
    payload["requirements"] = [payload["requirements"][0]]
    changed = client.put(
        f"/api/opportunities/{opportunity_id}", headers=csrf(token), json=payload
    )
    assert changed.status_code == 200, changed.text
    assert changed.json()["version"] == 2
    landscape = client.get("/api/opportunities/visualization/landscape").json()
    assert landscape["denominator"] == 1
    assert landscape["skills"]["python"] == 1

    assert client.get(f"/api/matches/{opportunity_id}/latest").status_code == 404
    assert client.post(
        f"/api/matches/{opportunity_id}/recommendations", headers=csrf(token)
    ).status_code == 409
    run = client.post(f"/api/matches/{opportunity_id}/run", headers=csrf(token))
    assert run.status_code == 201, run.text
    assert client.get(f"/api/matches/{opportunity_id}/latest").json()["id"] == run.json()["id"]
    assert len(client.get("/api/matches").json()) == 1
    recommendations = client.post(
        f"/api/matches/{opportunity_id}/recommendations", headers=csrf(token)
    )
    assert recommendations.status_code == 200, recommendations.text
    assert client.get("/api/matches/recommendations/all").status_code == 200
    alignment = client.get("/api/matches/portfolio/alignment").json()
    assert alignment["opportunity_count"] == 1
    assert "not hiring probability" in alignment["meaning"]

    artifact = client.post(
        "/api/artifacts",
        headers=csrf(token),
        json={"kind": "resume", "title": "Platform resume", "opportunity_id": opportunity_id, "evidence_ids": [claim_id]},
    )
    assert artifact.status_code == 201, artifact.text
    second = client.post(
        "/api/artifacts",
        headers=csrf(token),
        json={"kind": "resume", "title": "Platform resume", "opportunity_id": opportunity_id, "evidence_ids": [claim_id]},
    )
    assert second.json()["version"] == 2
    assert len(client.get("/api/artifacts").json()) == 2
    assert client.post(
        "/api/artifacts",
        headers=csrf(token),
        json={"kind": "resume", "title": "Invalid", "evidence_ids": ["missing"]},
    ).status_code == 400
    today = client.get("/api/workspace/today").json()
    assert today["confirmed_evidence"] == 1
    assert today["active_opportunities"] == 1
    assert today["global_alignment_coverage"] == 1


def test_file_capture_chat_history_and_deletion(client: TestClient) -> None:
    create_account("capture@example.com")
    token = login(client, "capture@example.com")
    captured = client.post(
        "/api/opportunities/capture-file",
        headers=csrf(token),
        data={"title": "Captured analyst", "employer": "Synthetic Analytics"},
        files={
            "file": (
                "role.txt",
                b"Python knowledge is required. Three years experience is preferred.",
                "text/plain",
            )
        },
    )
    assert captured.status_code == 201, captured.text
    assert captured.json()["source_kind"] == "file"
    providers = client.get("/api/agent/providers").json()
    assert "mock" in providers["providers"]
    assert providers["offline_available"] is True
    assert client.post(
        "/api/agent/chat",
        headers=csrf(token),
        json={"message": "Help with this role", "provider": "unconfigured"},
    ).status_code == 400
    chat = client.post(
        "/api/agent/chat",
        headers=csrf(token),
        json={"message": "Explain this job opportunity", "provider": "mock", "opportunity_id": captured.json()["id"]},
    )
    assert chat.status_code == 200, chat.text
    conversation_id = chat.json()["conversation_id"]
    follow_up = client.post(
        "/api/agent/chat",
        headers=csrf(token),
        json={"message": "How should I improve?", "provider": "mock", "conversation_id": conversation_id},
    )
    assert follow_up.status_code == 200
    assert len(client.get("/api/agent/conversations").json()) == 1
    messages = client.get(f"/api/agent/conversations/{conversation_id}/messages").json()
    assert [message["role"] for message in messages] == ["user", "assistant", "user", "assistant"]
    assert client.get("/api/agent/proposed-changes").json() == []
    assert client.delete(
        f"/api/agent/conversations/{conversation_id}", headers=csrf(token)
    ).status_code == 204
    assert client.get(f"/api/agent/conversations/{conversation_id}/messages").status_code == 404
    opportunity_id = captured.json()["id"]
    assert client.delete(
        f"/api/opportunities/{opportunity_id}", headers=csrf(token)
    ).status_code == 204
    assert client.get(f"/api/opportunities/{opportunity_id}").status_code == 404
