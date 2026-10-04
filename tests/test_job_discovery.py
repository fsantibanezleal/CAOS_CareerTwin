"""Synthetic boundary fixtures, separate from mandatory live provider/browser release checks."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from types import SimpleNamespace

import pytest
from sqlalchemy import select

from careertwin.database import SessionLocal
from careertwin.models import Opportunity, OpportunitySnapshot
from careertwin.services import job_discovery as service
from careertwin.services.job_discovery import DiscoveryError, SearchRequest
from tests.conftest import create_account, csrf, login


def fixture_job(**overrides):
    """Observed Himalayas shapes, with invented employer/content and no real person data."""
    return {
        "guid": "https://himalayas.app/companies/synthetic/jobs/research-lead",
        "title": "Research &amp; Analytics Lead",
        "companyName": "Synthetic Research",
        "description": "<p>Lead analytics programmes.</p><script>steal()</script><p>Python required.</p>",
        "excerpt": "Evidence-led analytics",
        "locationRestrictions": ["Chile"],
        "timezoneRestrictions": [-4, -3],
        "seniority": ["Manager"],
        "employmentType": "Full Time",
        "parentCategories": ["Data"],
        "pubDate": 1790075996,
        "expiryDate": 2092667993,
        "minSalary": 90000,
        "maxSalary": 120000,
        "currency": "USD",
        "salaryPeriod": "annual",
        **overrides,
    }


def response(jobs=None, **overrides):
    return {
        "jobs": [fixture_job()] if jobs is None else jobs,
        "totalCount": 21,
        "offset": 0,
        "limit": 20,
        **overrides,
    }


@pytest.fixture(autouse=True)
def empty_cache():
    service.cache.clear()
    yield
    service.cache.clear()


def test_normalization():
    now = datetime(2026, 10, 3, tzinfo=UTC)
    item = service.normalize(fixture_job(), "himalayas", now)
    assert item.title == "Research & Analytics Lead"
    assert item.description == "Lead analytics programmes.\n\nPython required."
    assert item.locations == ["Chile"] and item.timezones == ["-4", "-3"]
    assert item.published_at == datetime.fromtimestamp(1790075996, UTC)
    assert item.salary_min == 90000 and item.salary_period == "annual"
    object_shape = fixture_job(
        locationRestrictions=[{"name": "Chile", "alpha2": "CL"}],
        pubDate=1790075996000,
        minSalary=float("inf"),
    )
    second = service.normalize(object_shape, "himalayas", now)
    assert second.locations == item.locations and second.published_at == item.published_at
    assert second.salary_min is None
    assert service.normalize(fixture_job(locationRestrictions=[]), "himalayas", now).locations == [
        "Worldwide"
    ]
    assert (
        service.normalize(fixture_job(locationRestrictions=None), "himalayas", now).locations == []
    )
    for bad in [
        "http://himalayas.app/companies/x",
        "https://localhost/companies/x",
        "https://himalayas.app.evil/companies/x",
        "https://a@himalayas.app/companies/x",
        "https://himalayas.app:8144/companies/x",
        "javascript:alert(1)",
        "https://himalayas.app/companies/x#frag",
        "https://himalayas.app/companies/x\n",
    ]:
        with pytest.raises(ValueError):
            service.normalize(fixture_job(guid=bad), "himalayas", now)
    with pytest.raises(ValueError, match="Expired"):
        service.normalize(fixture_job(expiryDate=1000), "himalayas", now)
    jobicy = service.normalize(
        {
            "id": 123,
            "url": "https://jobicy.com/jobs/123-test",
            "jobTitle": "Data Lead",
            "companyName": "Synthetic",
            "jobDescription": "<p>Own delivery</p>",
            "jobGeo": "LATAM",
            "jobType": ["Full-Time"],
            "jobLevel": "Director",
            "pubDate": "2026-10-03T16:24:44-03:00",
            "salaryPeriod": "hourly",
        },
        "jobicy",
        now,
    )
    assert jobicy.locations == ["LATAM"] and jobicy.published_at.hour == 19
    assert jobicy.expires_at is None and jobicy.salary_min is None


def test_search_contract(client, monkeypatch):
    observed = []
    monkeypatch.setattr(
        service,
        "fetch_json",
        lambda provider, params: observed.append((provider, params)) or response(),
    )
    assert client.post("/api/job-search", json={}).status_code == 401
    create_account("search@example.com")
    token = login(client, "search@example.com")
    assert client.post("/api/job-search", json={}).status_code == 403
    result = client.post(
        "/api/job-search", headers=csrf(token), json={"query": "analytics", "country": "CL"}
    )
    assert result.status_code == 200, result.text
    page = result.json()
    assert page["provider"] == "himalayas" and page["next_page"] == 2
    assert page["jobs"][0]["import_ticket"] and not page["jobs"][0]["saved_opportunity_id"]
    assert observed == [
        ("himalayas", {"q": "analytics", "country": "CL", "sort": "recent", "page": "1"})
    ]
    assert client.get("/api/opportunities").json() == []
    for filters in [
        {"provider": "unknown"},
        {"provider": "jobicy", "country": "CL"},
        {"country": "CL", "worldwide": True},
        {"provider": "himalayas", "cursor": "x"},
        {"page": 0},
        {"query": "x" * 161},
        {"profile": "never export"},
        {"query": "a\nb"},
    ]:
        assert client.post("/api/job-search", headers=csrf(token), json=filters).status_code == 422
    service.cache.clear()
    monkeypatch.setattr(service, "fetch_json", lambda *args: response(jobs=[], totalCount=0))
    empty = client.post("/api/job-search", headers=csrf(token), json={})
    assert empty.json()["jobs"] == [] and not empty.json()["has_more"]
    service.cache.clear()

    def failing(*args):
        raise DiscoveryError("Job source is unavailable. Try again later.")

    monkeypatch.setattr(service, "fetch_json", failing)
    assert client.post("/api/job-search", headers=csrf(token), json={}).status_code == 502


def test_import_isolation_and_provenance(client, monkeypatch):
    monkeypatch.setattr(service, "fetch_json", lambda *args: response())
    create_account("owner@example.com")
    create_account("other@example.com")
    token = login(client, "owner@example.com")
    page = client.post("/api/job-search", json={}, headers=csrf(token)).json()
    ticket = page["jobs"][0]["import_ticket"]
    assert client.post("/api/job-search/import", json={"ticket": ticket}).status_code == 403
    extra = client.post(
        "/api/job-search/import",
        json={"ticket": ticket, "source_url": "http://localhost"},
        headers=csrf(token),
    )
    assert extra.status_code == 422
    saved = client.post("/api/job-search/import", json={"ticket": ticket}, headers=csrf(token))
    assert saved.status_code == 200, saved.text
    data = saved.json()
    assert data["created"] is True
    role = data["opportunity"]
    assert role["requirements"] == [] and role["deadline_at"] is None
    assert role["structured_data"]["discovery"]["locations"] == ["Chile"]
    assert role["structured_data"]["discovery"]["review_status"] == "needs_review"
    assert role["compensation"]["source_min"] == 90000
    with SessionLocal() as db:
        assert db.scalar(
            select(OpportunitySnapshot).where(OpportunitySnapshot.opportunity_id == role["id"])
        )
        assert db.scalar(select(Opportunity)).source_sha256
    other_token = login(client, "other@example.com")
    assert (
        client.post(
            "/api/job-search/import", json={"ticket": ticket}, headers=csrf(other_token)
        ).status_code
        == 403
    )
    other_page = client.post("/api/job-search", json={}, headers=csrf(other_token)).json()
    assert other_page["cached"] and other_page["jobs"][0]["saved_opportunity_id"] is None
    assert other_page["jobs"][0]["import_ticket"] != ticket
    assert client.get(f"/api/opportunities/{role['id']}").status_code == 404
    assert client.get("/api/opportunities").json() == []


def test_duplicate_and_expired_import(client, monkeypatch):
    monkeypatch.setattr(service, "fetch_json", lambda *args: response())
    create_account("owner@example.com")
    token = login(client, "owner@example.com")
    job = client.post("/api/job-search", json={}, headers=csrf(token)).json()["jobs"][0]
    first = client.post(
        "/api/job-search/import", json={"ticket": job["import_ticket"]}, headers=csrf(token)
    ).json()
    second = client.post(
        "/api/job-search/import", json={"ticket": job["import_ticket"]}, headers=csrf(token)
    ).json()
    assert first["created"] and not second["created"]
    assert first["opportunity"]["id"] == second["opportunity"]["id"]
    assert len(client.get("/api/opportunities").json()) == 1
    result = client.post("/api/job-search", json={}, headers=csrf(token)).json()
    assert result["jobs"][0]["saved_opportunity_id"] == first["opportunity"]["id"]
    for malformed in [
        job["import_ticket"] + "x",
        "invalid",
        ".bad",
        "x." + "0" * 64,
        job["import_ticket"].split(".")[0] + "." + "ñ" * 64,
    ]:
        assert (
            client.post(
                "/api/job-search/import", json={"ticket": malformed}, headers=csrf(token)
            ).status_code
            == 400
        )
    # Expire the preview, not the authentication cookie or the application's clock.
    clock = service.time.time()
    with monkeypatch.context() as patch:
        patch.setattr(service.time, "time", lambda: clock - service.TTL - 1)
        parts = job["import_ticket"].split(".")
        payload = (
            service.base64.urlsafe_b64decode(parts[0] + "=" * (-len(parts[0]) % 4))
            .decode()
            .split(":")
        )
        from careertwin.config import get_settings

        expired_ticket = service.issue_ticket(
            *payload[:3], get_settings().app_secret_key.get_secret_value()
        )
    assert (
        client.post(
            "/api/job-search/import", json={"ticket": expired_ticket}, headers=csrf(token)
        ).status_code
        == 410
    )
    service.cache.clear()
    monkeypatch.undo()
    assert (
        client.post(
            "/api/job-search/import", json={"ticket": job["import_ticket"]}, headers=csrf(token)
        ).status_code
        == 410
    )


def test_cache_and_cooldown(monkeypatch):
    calls = []
    clock = [100.0]
    monkeypatch.setattr(service.time, "monotonic", lambda: clock[0])
    monkeypatch.setattr(service, "fetch_json", lambda *args: calls.append(args) or response())
    key, page = service.cache.search(SearchRequest(query="analytics"))
    page.jobs[0].import_ticket = "private-user-ticket"
    assert service.cache.search(SearchRequest(query="analytics"))[1].cached
    assert service.cache.job(key, page.jobs[0].key).import_ticket == ""
    assert len(calls) == 1
    with pytest.raises(DiscoveryError) as failure:
        service.cache.search(SearchRequest(query="different"))
    assert failure.value.status == 429
    for index in range(service.MAX_PAGES + 5):
        clock[0] += 2
        service.cache.search(SearchRequest(query=str(index)))
    assert len(service.cache.pages) == service.MAX_PAGES
    clock[0] += service.TTL + 1
    with pytest.raises(DiscoveryError) as expired:
        service.cache.job(key, page.jobs[0].key)
    assert expired.value.status == 410


def test_fetch_boundary(monkeypatch):
    requests = []
    payload = [json.dumps(response()).encode()]
    status = [200]
    headers = {"content-type": "application/json"}

    class Wire:
        def close(self):
            pass

        def settimeout(self, value):
            pass

    class Response:
        def __init__(self):
            self.status = status[0]

        def getheader(self, key):
            return headers.get(key)

        def read(self, size):
            assert size == service.MAX_BYTES + 1
            return payload[0][:size]

    class Connection:
        def __init__(self, *args, **kwargs):
            pass

        def request(self, method, path, headers):
            requests.append((method, path, headers))

        def getresponse(self):
            return Response()

        def close(self):
            pass

    urls = []
    monkeypatch.setattr(
        service,
        "_resolve_public_target",
        lambda url: (
            urls.append(url)
            or SimpleNamespace(
                addresses=("8.8.8.8",),
                hostname="himalayas.app",
                request_target="/jobs/api/search?q=x",
            )
        ),
    )
    monkeypatch.setattr(service.socket, "create_connection", lambda target, timeout: Wire())
    monkeypatch.setattr(
        service.ssl,
        "create_default_context",
        lambda: SimpleNamespace(wrap_socket=lambda *args, **kwargs: Wire()),
    )
    monkeypatch.setattr(service.http.client, "HTTPConnection", Connection)
    service.fetch_json("himalayas", {"q": "data & AI"})
    assert urls == ["https://himalayas.app/jobs/api/search?q=data+%26+AI"]
    assert "Authorization" not in requests[0][2] and "Cookie" not in requests[0][2]
    for code in [302, 500, 429]:
        status[0] = code
        with pytest.raises(DiscoveryError) as error:
            service.fetch_json("himalayas", {})
        assert error.value.status == (429 if code == 429 else 502)
    status[0] = 200
    payload[0] = b"x" * (service.MAX_BYTES + 1)
    with pytest.raises(DiscoveryError, match="safety limit"):
        service.fetch_json("himalayas", {})
    payload[0] = b'{"success": false, "error": "never surface upstream secrets"}'
    with pytest.raises(DiscoveryError, match="unsupported response"):
        service.fetch_json("himalayas", {})


def test_jobicy_cursor_and_live_locations(monkeypatch):
    monkeypatch.setattr(
        service,
        "fetch_json",
        lambda provider, params: {
            "locations": [{"geoName": "LATAM", "geoSlug": "latam"}],
            "jobs": [
                {
                    "id": 1,
                    "url": "https://jobicy.com/jobs/1-test",
                    "jobTitle": "Data Lead",
                    "jobDescription": "Own delivery",
                    "jobGeo": "LATAM",
                }
            ],
            "nextCursor": "opaque=token",
        },
    )
    assert service.cache.jobicy_locations() == [{"value": "latam", "label": "LATAM"}]
    request = SearchRequest(provider="jobicy", query="data", geo="latam", cursor="previous")
    assert request.parameters() == {
        "count": "20",
        "tag": "data",
        "geo": "latam",
        "cursor": "previous",
    }
    page = service.cache.search(request)[1]
    assert page.next_cursor == "opaque=token" and page.next_page is None and page.has_more
    with pytest.raises(DiscoveryError, match="supported location"):
        service.cache.search(SearchRequest(provider="jobicy", geo="unsupported"))


def test_catalog_failure_is_bounded(monkeypatch):
    calls = []
    def unavailable(*args):
        calls.append(args)
        raise DiscoveryError("Job source is temporarily unavailable.")
    monkeypatch.setattr(service, "fetch_json", unavailable)
    for _ in range(2):
        with pytest.raises(DiscoveryError, match="temporarily unavailable"):
            service.cache.jobicy_locations()
    assert len(calls) == 1


def test_presets_are_private_and_do_not_search(client, monkeypatch):
    """Presets are tenant metadata, not automatic outbound provider requests."""
    monkeypatch.setattr(service, "fetch_json", lambda *args: pytest.fail("Preset must not fetch"))
    create_account("owner@example.com")
    create_account("other@example.com")
    token = login(client, "owner@example.com")
    body = {"name": "Leadership CL", "search": {"query": "data director", "country": "CL"}}
    assert client.post("/api/job-search/presets", json=body).status_code == 403
    result = client.post("/api/job-search/presets", json=body, headers=csrf(token))
    assert result.status_code == 201, result.text
    preset_id = result.json()["id"]
    assert len(client.get("/api/job-search/presets").json()) == 1
    other_token = login(client, "other@example.com")
    assert client.get("/api/job-search/presets").json() == []
    assert (
        client.delete(f"/api/job-search/presets/{preset_id}", headers=csrf(other_token)).status_code
        == 404
    )
    token = login(client, "owner@example.com")
    assert (
        client.post(
            "/api/job-search/presets", json={**body, "search": {"page": 2}}, headers=csrf(token)
        ).status_code
        == 422
    )
    for _ in range(11):
        assert (
            client.post("/api/job-search/presets", json=body, headers=csrf(token)).status_code
            == 201
        )
    assert client.post("/api/job-search/presets", json=body, headers=csrf(token)).status_code == 409
    assert (
        client.delete(f"/api/job-search/presets/{preset_id}", headers=csrf(token)).status_code
        == 204
    )
    assert len(client.get("/api/job-search/presets").json()) == 11
