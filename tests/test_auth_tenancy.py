"""Authentication, authorization and account isolation contracts."""

from __future__ import annotations

from fastapi.testclient import TestClient

from tests.conftest import (
    INVITE_TEST_PASSWORD,
    ROTATED_TEST_PASSWORD,
    SYNTHETIC_TEST_PASSWORD,
    create_account,
    csrf,
    login,
)


def test_login_is_landing_and_registration_is_absent(client: TestClient) -> None:
    create_account("seeker-a@example.com")
    assert client.post("/api/auth/register", json={}).status_code in {404, 405}
    assert client.get("/api/auth/me").status_code == 401
    token = login(client, "seeker-a@example.com")
    assert client.get("/api/auth/me").json()["email"] == "seeker-a@example.com"
    assert client.put("/api/profile", json={}).status_code == 403
    assert token


def test_account_preferences_persist_and_password_rotation_revokes_sessions(
    client: TestClient,
) -> None:
    create_account("seeker-a@example.com")
    token = login(client, "seeker-a@example.com")
    preferences = client.patch(
        "/api/auth/preferences",
        headers=csrf(token),
        json={"locale": "es", "theme": "light"},
    )
    assert preferences.status_code == 200, preferences.text
    assert preferences.json()["locale"] == "es"
    assert preferences.json()["theme"] == "light"
    changed = client.post(
        "/api/auth/change-password",
        headers=csrf(token),
        json={
            "current_password": SYNTHETIC_TEST_PASSWORD,
            "new_password": ROTATED_TEST_PASSWORD,
        },
    )
    assert changed.status_code == 204, changed.text
    assert client.get("/api/auth/me").status_code == 401
    assert login(client, "seeker-a@example.com", ROTATED_TEST_PASSWORD)


def test_tenant_ids_cannot_cross_profile_or_opportunity_boundary(client: TestClient) -> None:
    create_account("seeker-a@example.com")
    create_account("seeker-b@example.com")
    token_a = login(client, "seeker-a@example.com")
    created = client.post(
        "/api/opportunities",
        headers=csrf(token_a),
        json={
            "title": "Synthetic Role A",
            "description": "Requires deterministic test engineering.",
            "requirements": [{"label": "test engineering"}],
        },
    )
    assert created.status_code == 201, created.text
    opportunity_id = created.json()["id"]
    client.post("/api/auth/logout", headers=csrf(token_a))
    login(client, "seeker-b@example.com")
    assert client.get(f"/api/opportunities/{opportunity_id}").status_code == 404
    assert client.get("/api/opportunities").json() == []


def test_superuser_manages_accounts_without_a_content_browser(client: TestClient) -> None:
    create_account("admin@example.com", superuser=True)
    token = login(client, "admin@example.com")
    created = client.post(
        "/api/admin/users",
        headers=csrf(token),
        json={
            "email": "invited@example.com",
            "display_name": "Invited User",
            "temporary_password": INVITE_TEST_PASSWORD,
        },
    )
    assert created.status_code == 201, created.text
    invited_id = created.json()["id"]
    users = client.get("/api/admin/users").json()
    assert {user["email"] for user in users} == {"admin@example.com", "invited@example.com"}
    assert all("profile" not in user and "workspace_id" not in user for user in users)
    assert (
        client.post(f"/api/admin/users/{invited_id}/disable", headers=csrf(token)).status_code
        == 200
    )
    assert (
        client.post(f"/api/admin/users/{invited_id}/restore", headers=csrf(token)).status_code
        == 200
    )
