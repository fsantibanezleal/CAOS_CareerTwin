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


def test_workspace_stage_events_are_ordered_and_tenant_scoped(client: TestClient) -> None:
    """One request returns every application's history, and only the caller's."""
    create_account("events-a@example.com")
    create_account("events-b@example.com")
    token_a = login(client, "events-a@example.com")
    first, second = (
        client.post(
            "/api/opportunities", headers=csrf(token_a), json={"title": f"Synthetic Role {name}"}
        ).json()
        for name in ("One", "Two")
    )
    apps = [
        client.post(
            "/api/pipeline/applications",
            headers=csrf(token_a),
            json={"opportunity_id": item["id"], "channel": "direct"},
        ).json()
        for item in (first, second)
    ]
    moved = client.post(
        f"/api/pipeline/applications/{apps[0]['id']}/stage",
        headers=csrf(token_a),
        json={"stage": "preparing", "note": "Synthetic preparation"},
    )
    assert moved.status_code == 200, moved.text

    events = client.get("/api/pipeline/events").json()
    assert [(item["application_id"], item["to_stage"]) for item in events] == [
        (apps[0]["id"], "saved"),
        (apps[1]["id"], "saved"),
        (apps[0]["id"], "preparing"),
    ]
    assert events[2]["from_stage"] == "saved"
    assert events[2]["note"] == "Synthetic preparation"
    # The workspace list agrees with the per-application history it replaces.
    for app in apps:
        history = client.get(f"/api/pipeline/applications/{app['id']}/history").json()
        assert [item["id"] for item in history] == [
            item["id"] for item in events if item["application_id"] == app["id"]
        ]

    client.post("/api/auth/logout", headers=csrf(token_a))
    login(client, "events-b@example.com")
    assert client.get("/api/pipeline/events").json() == []
