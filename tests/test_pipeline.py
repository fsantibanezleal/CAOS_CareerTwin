"""Candidate pipeline state, task and calendar contracts."""

from __future__ import annotations

from fastapi.testclient import TestClient

from tests.conftest import create_account, csrf, login


def test_application_transition_history_and_calendar(client: TestClient) -> None:
    create_account("pipeline@example.com")
    token = login(client, "pipeline@example.com")
    opportunity = client.post(
        "/api/opportunities",
        headers=csrf(token),
        json={"title": "Synthetic Operations Role"},
    ).json()
    application = client.post(
        "/api/pipeline/applications",
        headers=csrf(token),
        json={"opportunity_id": opportunity["id"], "channel": "community"},
    ).json()
    invalid = client.post(
        f"/api/pipeline/applications/{application['id']}/stage",
        headers=csrf(token),
        json={"stage": "offer"},
    )
    assert invalid.status_code == 409
    for stage in ("preparing", "applied", "screening", "interview"):
        response = client.post(
            f"/api/pipeline/applications/{application['id']}/stage",
            headers=csrf(token),
            json={"stage": stage, "note": "Synthetic transition"},
        )
        assert response.status_code == 200, response.text
    task = client.post(
        "/api/pipeline/tasks",
        headers=csrf(token),
        json={
            "application_id": application["id"],
            "kind": "meeting",
            "title": "Synthetic interview",
            "starts_at": "2026-08-10T15:00:00Z",
            "due_at": "2026-08-10T16:00:00Z",
        },
    )
    assert task.status_code == 201, task.text
    calendar = client.get("/api/pipeline/calendar.ics")
    assert calendar.status_code == 200
    assert b"BEGIN:VCALENDAR" in calendar.content
    history = client.get(f"/api/pipeline/applications/{application['id']}/history").json()
    assert [item["to_stage"] for item in history] == [
        "saved",
        "preparing",
        "applied",
        "screening",
        "interview",
    ]
