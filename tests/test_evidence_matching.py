"""Evidence lifecycle, graph projection and deterministic matching contracts."""

from __future__ import annotations

from fastapi.testclient import TestClient

from tests.conftest import create_account, csrf, login


def test_claim_requires_decision_and_match_is_idempotent(client: TestClient) -> None:
    create_account("matcher@example.com")
    token = login(client, "matcher@example.com")
    claim = client.post(
        "/api/profile/claims",
        headers=csrf(token),
        json={
            "claim_type": "skill",
            "statement": "Built tested Python services for five years.",
            "normalized_value": {"skill": "python"},
            "source_locator": {"kind": "manual"},
            "confidence": 1,
        },
    )
    assert claim.status_code == 201, claim.text
    claim_id = claim.json()["id"]
    assert claim.json()["state"] == "proposed"
    decision = client.post(
        f"/api/profile/claims/{claim_id}/decision",
        headers=csrf(token),
        json={"decision": "confirmed", "note": "Verified by the account owner"},
    )
    assert decision.status_code == 200
    skill = client.post(
        "/api/profile/skills",
        headers=csrf(token),
        json={
            "name": "Python",
            "level": 0.9,
            "years": 5,
            "confidence": 1,
            "evidence_ids": [claim_id],
        },
    )
    assert skill.status_code == 201, skill.text
    opportunity = client.post(
        "/api/opportunities",
        headers=csrf(token),
        json={
            "title": "Synthetic Python Engineer",
            "requirements": [
                {
                    "category": "skill",
                    "label": "Python",
                    "normalized_name": "python",
                    "importance": "required",
                    "minimum_level": 0.8,
                },
                {
                    "category": "skill",
                    "label": "Kubernetes",
                    "importance": "preferred",
                },
            ],
        },
    ).json()
    first = client.post(f"/api/matches/{opportunity['id']}/run", headers=csrf(token))
    second = client.post(f"/api/matches/{opportunity['id']}/run", headers=csrf(token))
    assert first.status_code == 201, first.text
    assert second.status_code == 201, second.text
    assert first.json()["id"] == second.json()["id"]
    assert first.json()["coverage"] == 1
    assert first.json()["components"]["meaning"] == "Evidence alignment, not hiring probability"
    graph = client.get("/api/profile/graph").json()
    assert any(node["type"] == "skill" for node in graph["graph"]["nodes"])
    assert graph["matrix"][0]["evidence"][0]["id"] == claim_id


def test_insufficient_evidence_has_no_point_score(client: TestClient) -> None:
    create_account("unknown@example.com")
    token = login(client, "unknown@example.com")
    opportunity = client.post(
        "/api/opportunities",
        headers=csrf(token),
        json={
            "title": "Evidence-heavy role",
            "requirements": [
                {"category": "experience", "label": "Distributed systems experience"},
                {"category": "education", "label": "Relevant degree"},
            ],
        },
    ).json()
    result = client.post(f"/api/matches/{opportunity['id']}/run", headers=csrf(token)).json()
    assert result["score"] is None
    assert result["coverage"] == 0
    assert result["lower_bound"] == 0
    assert result["upper_bound"] == 1
