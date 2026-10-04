"""Ready source text is a private read, never an executable HTML document."""

from sqlalchemy import select

from careertwin.database import SessionLocal
from careertwin.models import Source, SourceStatus, User
from tests.conftest import create_account, login


def test_profile_source_text_is_tenant_owned(client):
    create_account("owner@example.com")
    create_account("other@example.com")
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == "owner@example.com"))
        source = Source(
            workspace_id=user.workspace.id,
            kind="document",
            label="Synthetic original",
            status=SourceStatus.READY,
            extracted_text="<script>inert()</script>\nSynthetic evidence.",
        )
        missing = Source(
            workspace_id=user.workspace.id,
            kind="document",
            label="Metadata only",
            status=SourceStatus.READY,
        )
        db.add_all([source, missing])
        db.commit()
        source_id, missing_id = source.id, missing.id
    assert client.get(f"/api/profile/sources/{source_id}/text").status_code == 401
    login(client, "owner@example.com")
    response = client.get(f"/api/profile/sources/{source_id}/text")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/plain")
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["x-content-type-options"] == "nosniff"
    assert "Synthetic evidence" in response.text
    assert client.get(f"/api/profile/sources/{missing_id}/text").status_code == 409
    rows = {row["id"]: row for row in client.get("/api/profile/sources").json()}
    assert rows[source_id]["text_available"] is True
    assert rows[missing_id]["text_available"] is False
    login(client, "other@example.com")
    assert client.get(f"/api/profile/sources/{source_id}/text").status_code == 404
    assert client.get("/api/profile/sources").json() == []
