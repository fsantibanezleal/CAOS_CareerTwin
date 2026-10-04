"""The evidence a skill reports is its confirmed evidence, and is identified, not only counted.

`evidence_count` counted every linked claim, proposed and rejected included, while the
matcher and the endpoint's own description mean confirmed evidence. The two agreed only
while every claim in a workspace happened to be confirmed. The profile's skill map now
shows which claims back a skill, so the identifiers are part of the contract as well.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from careertwin.database import SessionLocal
from careertwin.models import ClaimState, EvidenceClaim, ProfessionalProfile, Skill
from careertwin.services.graph import build_profile_graph
from tests.conftest import create_account, csrf, login


def _claim(client: TestClient, token: str, statement: str, decision: str) -> str:
    claim = client.post(
        "/api/profile/claims",
        headers=csrf(token),
        json={"claim_type": "skill", "statement": statement, "normalized_value": {"skill": "Python"}, "confidence": 0.9},
    ).json()
    decided = client.post(
        f"/api/profile/claims/{claim['id']}/decision",
        headers=csrf(token),
        json={"decision": decision, "note": "Reviewed"},
    )
    assert decided.status_code == 200, decided.text
    return claim["id"]


def test_skill_reports_only_its_confirmed_evidence(client: TestClient) -> None:
    create_account("evidence@example.com")
    token = login(client, "evidence@example.com")
    confirmed = _claim(client, token, "Delivered production Python systems.", "confirmed")

    created = client.post(
        "/api/profile/skills",
        headers=csrf(token),
        json={
            "name": "Python",
            "level": 0.9,
            "years": 8,
            "confidence": 0.9,
            "category": "language",
            "evidence_ids": [confirmed],
        },
    )
    assert created.status_code == 201, created.text

    skill = client.get("/api/profile/skills").json()[0]
    assert skill["evidence_count"] == 1
    assert skill["evidence_ids"] == [confirmed]
    projection = client.get("/api/profile/graph").json()
    skill_node = next(n for n in projection["graph"]["nodes"] if n["type"] == "skill")
    assert skill_node["evidence_count"] == 1
    assert projection["matrix"][0]["evidence"][0]["id"] == confirmed


def test_unevidenced_skill_reports_nothing(client: TestClient) -> None:
    create_account("bare@example.com")
    token = login(client, "bare@example.com")
    created = client.post(
        "/api/profile/skills",
        headers=csrf(token),
        json={"name": "Go", "level": 0.6, "years": 2, "confidence": 0.5, "category": "language", "evidence_ids": []},
    )
    assert created.status_code == 201, created.text

    skill = client.get("/api/profile/skills").json()[0]
    assert skill["evidence_count"] == 0
    assert skill["evidence_ids"] == []

    projection = client.get("/api/profile/graph").json()
    assert projection["matrix"][0]["evidence"] == []
    assert next(n for n in projection["graph"]["nodes"] if n["type"] == "skill")["evidence_count"] == 0


@pytest.mark.parametrize("withdrawn_state", [ClaimState.SUPERSEDED, ClaimState.REJECTED, ClaimState.PROPOSED])
def test_a_linked_claim_that_leaves_confirmed_stops_counting(
    client: TestClient, withdrawn_state: ClaimState
) -> None:
    """The case the old count got wrong: evidence that was linked, then stopped being confirmed.

    No API path produces this today: a decided claim cannot be re-decided, and the
    SUPERSEDED state is declared but never set. The model allows it, though, so the state is
    written directly here to hold the serializer to the definition it states.
    """
    create_account("withdrawn@example.com")
    token = login(client, "withdrawn@example.com")
    claim = _claim(client, token, "Led a data platform migration.", "confirmed")
    created = client.post(
        "/api/profile/skills",
        headers=csrf(token),
        json={"name": "Databricks", "level": 0.9, "years": 4, "confidence": 0.9, "category": "data-platform", "evidence_ids": [claim]},
    )
    assert created.status_code == 201, created.text
    assert client.get("/api/profile/skills").json()[0]["evidence_count"] == 1

    with SessionLocal() as db:
        record = db.get(EvidenceClaim, claim)
        assert record is not None
        record.state = withdrawn_state
        db.commit()

    skill = client.get("/api/profile/skills").json()[0]
    assert skill["evidence_count"] == 0
    assert skill["evidence_ids"] == []
    projection = client.get("/api/profile/graph").json()
    assert projection["matrix"][0]["evidence"] == []
    assert next(n for n in projection["graph"]["nodes"] if n["type"] == "skill")["evidence_count"] == 0
    assert all(n["id"] != f"claim:{claim}" for n in projection["graph"]["nodes"])
    assert all(e["target"] != f"claim:{claim}" for e in projection["graph"]["edges"])


def test_graph_service_does_not_project_foreign_or_unconfirmed_support() -> None:
    """Even direct callers cannot turn a foreign or proposed claim into a support edge."""
    profile = ProfessionalProfile(id="profile", workspace_id="ours", headline="Synthetic profile")
    claims = [
        EvidenceClaim(id="confirmed", workspace_id="ours", state=ClaimState.CONFIRMED,
                      statement="Confirmed synthetic evidence", confidence=0.9),
        EvidenceClaim(id="proposed", workspace_id="ours", state=ClaimState.PROPOSED,
                      statement="Unconfirmed synthetic evidence", confidence=0.9),
        EvidenceClaim(id="foreign", workspace_id="theirs", state=ClaimState.CONFIRMED,
                      statement="Foreign synthetic evidence", confidence=0.9),
    ]
    skill = Skill(id="skill", workspace_id="ours", name="Python", level=0.8, confidence=0.9,
                  evidence=claims)
    graph = build_profile_graph(profile, [skill], [], [], claims)
    assert next(n for n in graph["nodes"] if n["type"] == "skill")["evidence_count"] == 1
    evidence_nodes = {n["id"] for n in graph["nodes"] if n["type"] == "evidence"}
    assert evidence_nodes == {"claim:confirmed"}
