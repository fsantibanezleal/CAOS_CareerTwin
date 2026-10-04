"""Synthetic provider boundaries exercise real battery assembly, authorization and persistence."""

import pytest
from pydantic import ValidationError

from careertwin.services import job_discovery as discovery
from careertwin.services import search_battery as battery
from tests.conftest import create_account, csrf, login
from tests.test_job_discovery import response


@pytest.fixture(autouse=True)
def reset_cache(monkeypatch):
    discovery.cache.clear()
    monkeypatch.setattr(discovery.time, "sleep", lambda _: None)
    yield
    discovery.cache.clear()


def getonbrd_record(**attributes):
    return {
        "id": "synthetic-ai",
        "links": {
            "public_url": "https://www.getonbrd.com/jobs/data-science-analytics/synthetic-ai"
        },
        "attributes": {
            "title": "Head of Analytics",
            "functions": "<p>Lead an analytics area.</p>",
            "remote_modality": "hybrid",
            "published_at": "2026-10-04T00:00:00Z",
            "company": {"data": {"attributes": {"name": "Synthetic"}}},
            "location_cities": {"data": [{"attributes": {"name": "Santiago", "country": "Chile"}}]},
            **attributes,
        },
    }


def test_battery_bounds_and_partial_failures(monkeypatch):
    calls = []

    def fetch(provider, parameters):
        calls.append((provider, parameters))
        if provider == "jobicy":
            raise discovery.DiscoveryError("Source unavailable")
        return response()

    monkeypatch.setattr(discovery, "fetch_json", fetch)
    payload = battery.BatteryRequest(
        searches=[
            {"provider": provider, "query": "analytics"} for provider in ["himalayas", "jobicy"]
        ]
    )
    page, keys = battery.execute_battery(payload)
    assert page.partial and len(page.jobs) == 1 and len(keys) == 1
    assert {item.status for item in page.coverage} == {"ok", "error"}
    assert next(item for item in page.coverage if item.status == "ok").next_search.page == 2
    with pytest.raises(ValidationError):
        battery.BatteryRequest(searches=[{"query": str(index)} for index in range(7)])
    with pytest.raises(ValidationError):
        battery.BatteryRequest(searches=[{"query": "same"}, {"query": "same"}])
    assert battery.BATTERY_SLOTS.acquire(blocking=False)
    assert battery.BATTERY_SLOTS.acquire(blocking=False)
    try:
        with pytest.raises(discovery.DiscoveryError, match="capacity"):
            battery.execute_battery(payload)
    finally:
        battery.BATTERY_SLOTS.release()
        battery.BATTERY_SLOTS.release()


def test_time_budget_and_title_filter(monkeypatch):
    monkeypatch.setattr(discovery, "fetch_json", lambda *_: response())
    page, _ = battery.execute_battery(
        battery.BatteryRequest(searches=[{"query": "Head"}], title_only=True)
    )
    assert page.coverage[0].source_count == 1 and page.coverage[0].found == 0 and not page.jobs
    clock_values = iter([0, 31])
    monkeypatch.setattr(battery.time, "monotonic", lambda: next(clock_values))
    page, _ = battery.execute_battery(battery.BatteryRequest(searches=[{"query": "head"}]))
    assert page.partial and page.coverage[0].status == "not_run"
    assert battery.title_matches("Subgerente de Analítica", "subgerente analitica")
    assert not battery.title_matches("Analytics Scientist", "head analytics")


def test_tickets_dedup_and_tenant_isolation(client, monkeypatch):
    monkeypatch.setattr(discovery, "fetch_json", lambda *_: response())
    create_account("one@example.com")
    token = login(client, "one@example.com")
    payload = {"searches": [{"query": "analytics"}, {"query": "lead"}]}
    assert client.post("/api/job-search/battery", json=payload).status_code == 403
    result = client.post("/api/job-search/battery", headers=csrf(token), json=payload)
    assert result.status_code == 200, result.text
    page = result.json()
    assert len(page["jobs"]) == 1 and len(page["provenance"][page["jobs"][0]["key"]]) == 2
    ticket = page["jobs"][0]["import_ticket"]
    assert client.get("/api/opportunities").json() == []
    first = client.post("/api/job-search/import", headers=csrf(token), json={"ticket": ticket})
    assert first.status_code == 200 and first.json()["created"]
    second = client.post("/api/job-search/import", headers=csrf(token), json={"ticket": ticket})
    assert not second.json()["created"]
    create_account("two@example.com")
    token = login(client, "two@example.com")
    assert (
        client.post(
            "/api/job-search/import", headers=csrf(token), json={"ticket": ticket}
        ).status_code
        == 403
    )


def test_getonbrd_normalization_and_pages(monkeypatch):
    monkeypatch.setattr(
        discovery,
        "fetch_json",
        lambda *_: {
            "data": [getonbrd_record(), getonbrd_record(rejected_reasons=["spam"])],
            "meta": {"page": 1, "total_pages": 3},
        },
    )
    _, page = discovery.cache.search(discovery.SearchRequest(provider="getonbrd", country="CL"))
    job = page.jobs[0]
    assert job.remote_mode == "hybrid" and job.locations == ["Santiago, Chile"]
    assert job.salary_basis == job.salary_period == "" and job.currency == "USD"
    assert page.next_page == 2 and page.has_more and page.skipped_records == 1
    assert (
        discovery.SearchRequest(provider="getonbrd", country="CL").parameters()["country_code"]
        == "cl"
    )
    with pytest.raises(ValidationError):
        discovery.SearchRequest(provider="getonbrd", worldwide=True)
    discovery.cache.clear()
    monkeypatch.setattr(
        discovery, "fetch_json", lambda *_: {"data": [], "meta": {"page": 99, "total_pages": 3}}
    )
    with pytest.raises(discovery.DiscoveryError):
        discovery.cache.search(discovery.SearchRequest(provider="getonbrd"))


def test_private_batteries_and_strategy(client):
    create_account("one@example.com")
    token = login(client, "one@example.com")
    profile = client.get("/api/profile").json()
    strategy = {
        "current_role": "Synthetic leader",
        "target_titles": ["Head of Data"],
        "current_fixed": 100,
        "desired_uplift_percent": 25,
        "basis": "gross",
    }
    result = client.put(
        "/api/job-search/strategy",
        headers=csrf(token),
        json={"strategy": strategy, "revision": profile["revision"]},
    )
    assert result.status_code == 200 and result.json()["comparison"]["threshold"] == 125
    assert (
        client.put(
            "/api/job-search/strategy",
            headers=csrf(token),
            json={"strategy": strategy, "revision": profile["revision"]},
        ).status_code
        == 409
    )
    saved = client.post(
        "/api/job-search/batteries",
        headers=csrf(token),
        json={"name": "Leadership", "battery": {"searches": [{"query": "Head"}]}},
    )
    assert saved.status_code == 201, saved.text
    assert (
        client.get("/api/job-search/strategy").json()["strategy"]["current_role"]
        == "Synthetic leader"
    )
    assert (
        client.post(
            "/api/job-search/batteries",
            headers=csrf(token),
            json={"name": "Invalid", "battery": {"searches": [{"query": "Head", "page": 2}]}},
        ).status_code
        == 422
    )
    create_account("two@example.com")
    other = login(client, "two@example.com")
    assert client.get("/api/job-search/batteries").json() == []
    assert client.get("/api/job-search/strategy").json()["strategy"]["current_fixed"] is None
    assert (
        client.delete(
            f"/api/job-search/batteries/{saved.json()['id']}", headers=csrf(other)
        ).status_code
        == 404
    )
    token = login(client, "one@example.com")
    assert (
        client.delete(
            f"/api/job-search/batteries/{saved.json()['id']}", headers=csrf(token)
        ).status_code
        == 204
    )


def test_external_research_links(client):
    create_account("one@example.com")
    login(client, "one@example.com")
    links = client.get(
        "/api/job-search/research-links", params={"query": "Head Data & AI", "location": "Chile"}
    ).json()
    assert len(links) == 4 and all(item["url"].startswith("https://") for item in links)
    assert "Head+Data+%26+AI" in links[0]["url"]
    assert client.get("/api/job-search/research-links", params={"query": "x\ny"}).status_code == 422
