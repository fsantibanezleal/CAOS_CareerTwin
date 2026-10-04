"""SPA release transitions never reuse a cached chunk manifest."""
import pytest
from fastapi.testclient import TestClient

from careertwin import main


@pytest.mark.parametrize("route", ["/", "/profile", "/opportunities", "/pipeline"])
def test_spa_entry_is_not_cached(client: TestClient, tmp_path, monkeypatch, route: str) -> None:
    """Deep links and landing responses forbid reuse of obsolete release HTML."""
    (tmp_path / "index.html").write_text('<html><script src="/assets/current.js"></script></html>')
    monkeypatch.setattr(main, "frontend_dist", tmp_path)
    response = client.get(route)
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store, max-age=0"
    assert response.headers["pragma"] == "no-cache"
    assert response.headers["expires"] == "0"
    assert "current.js" in response.text
    assert client.get("/api/not-a-real-route").status_code == 404
