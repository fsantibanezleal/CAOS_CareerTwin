"""The evidence a skill reports is its confirmed evidence, and is identified, not only counted.

`evidence_count` counted every linked claim, proposed and rejected included, while the
matcher and the endpoint's own description mean confirmed evidence. The two agreed only
while every claim in a workspace happened to be confirmed. The profile's skill map now
shows which claims back a skill, so the identifiers are part of the contract as well.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from careertwin.database import SessionLocal
from careertwin.models import ClaimState, EvidenceClaim
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


def test_a_linked_claim_that_leaves_confirmed_stops_counting(client: TestClient) -> None:
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
        record.state = ClaimState.SUPERSEDED
        db.commit()

    skill = client.get("/api/profile/skills").json()[0]
    assert skill["evidence_count"] == 0
    assert skill["evidence_ids"] == []
