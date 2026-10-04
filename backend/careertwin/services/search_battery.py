"""Bounded federated discovery; partial coverage is explicit, never market completeness."""

from __future__ import annotations

import hashlib
import threading
import time
import unicodedata
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from typing import Literal
from urllib.parse import urlencode

from pydantic import BaseModel, ConfigDict, Field, model_validator

from careertwin.services.job_discovery import DiscoveredJob, DiscoveryError, SearchRequest, cache

BATTERY_SLOTS = threading.BoundedSemaphore(2)


class BatteryRequest(BaseModel):
    """At most six terms across three sources; continuations remain exact source requests."""

    model_config = ConfigDict(extra="forbid")
    searches: list[SearchRequest] = Field(min_length=1, max_length=18)
    title_only: bool = False

    @model_validator(mode="after")
    def bounded(self) -> BatteryRequest:
        terms = {item.query.casefold() for item in self.searches}
        identities = {item.model_dump_json() for item in self.searches}
        if len(terms) > 6 or len(identities) != len(self.searches):
            raise ValueError("Use at most six unique queries; duplicate requests are not allowed")
        return self


class SearchCoverage(BaseModel):
    """Independent verdict and continuation for one actual source/query page."""

    query_id: str
    search: SearchRequest
    status: Literal["ok", "error", "not_run"]
    found: int = 0
    source_count: int = 0
    skipped_records: int = 0
    cached: bool = False
    error: str = ""
    next_search: SearchRequest | None = None


class BatteryPage(BaseModel):
    """Unique offers with query provenance, and no hidden failed/unfinished sources."""

    jobs: list[DiscoveredJob]
    coverage: list[SearchCoverage]
    provenance: dict[str, list[str]]
    partial: bool
    retrieved_at: datetime


def query_identity(request: SearchRequest) -> str:
    """Stable identity across numbered/cursor pages without conflating filters."""
    value = request.model_copy(update={"page": 1, "cursor": ""})
    return hashlib.sha256(value.model_dump_json().encode()).hexdigest()


def title_matches(title: str, query: str) -> bool:
    """Unicode/accent-insensitive token containment, not an inferred profile match score."""
    import re

    def tokens(text: str) -> set[str]:
        normalized = "".join(
            char
            for char in unicodedata.normalize("NFKD", text.casefold())
            if not unicodedata.combining(char)
        )
        return set(re.findall(r"\w+", normalized))

    return tokens(query).issubset(tokens(title))


def execute_battery(payload: BatteryRequest) -> tuple[BatteryPage, dict[str, str]]:
    """Run source workers only; database/session/ticket issuance remains on the caller thread."""
    if not BATTERY_SLOTS.acquire(blocking=False):
        raise DiscoveryError(
            "Search capacity is busy. Try again after the current battery finishes.", 429
        )
    try:
        started = time.monotonic()
        groups = {
            provider: [item for item in payload.searches if item.provider == provider]
            for provider in dict.fromkeys(item.provider for item in payload.searches)
        }

        def source_worker(
            requests: list[SearchRequest],
        ) -> list[tuple[SearchCoverage, list[DiscoveredJob], str]]:
            results: list[tuple[SearchCoverage, list[DiscoveredJob], str]] = []
            for request in requests:
                verdict = SearchCoverage(
                    query_id=query_identity(request), search=request, status="not_run"
                )
                if time.monotonic() - started >= 30:
                    verdict.error = "Battery time budget reached. Continue this query explicitly."
                    results.append((verdict, [], ""))
                    continue
                try:
                    key, page = cache.search(request, wait_for_cooldown=True)
                    jobs = [
                        job
                        for job in page.jobs
                        if not payload.title_only or title_matches(job.title, request.query)
                    ]
                    verdict.status, verdict.found, verdict.source_count = (
                        "ok",
                        len(jobs),
                        len(page.jobs),
                    )
                    verdict.cached, verdict.skipped_records = page.cached, page.skipped_records
                    if page.has_more:
                        verdict.next_search = request.model_copy(
                            update={"page": page.next_page or 1, "cursor": page.next_cursor or ""}
                        )
                    results.append((verdict, jobs, key))
                except DiscoveryError as exc:
                    verdict.status, verdict.error = "error", str(exc)
                    results.append((verdict, [], ""))
            return results

        with ThreadPoolExecutor(max_workers=3, thread_name_prefix="job-battery") as pool:
            groups_results = list(pool.map(source_worker, groups.values()))
        coverage: list[SearchCoverage] = []
        unique: dict[str, DiscoveredJob] = {}
        keys: dict[str, str] = {}
        provenance: dict[str, list[str]] = {}
        for verdict, jobs, key in (result for group in groups_results for result in group):
            coverage.append(verdict)
            for job in jobs:
                url = job.source_url
                if url not in unique:
                    unique[url], keys[job.key], provenance[job.key] = job, key, []
                canonical_key = unique[url].key
                if verdict.query_id not in provenance[canonical_key]:
                    provenance[canonical_key].append(verdict.query_id)
        jobs = sorted(
            unique.values(),
            key=lambda item: (item.published_at or datetime.min.replace(tzinfo=UTC), item.key),
            reverse=True,
        )
        return BatteryPage(
            jobs=jobs,
            coverage=coverage,
            provenance=provenance,
            partial=any(item.status != "ok" for item in coverage),
            retrieved_at=datetime.now(UTC),
        ), keys
    finally:
        BATTERY_SLOTS.release()


def research_links(query: str, location: str) -> list[dict[str, str]]:
    """Explicit assisted research only; these websites are NOT searched by the battery."""
    return [
        {
            "name": "LinkedIn",
            "url": "https://www.linkedin.com/jobs/search/?"
            + urlencode({"keywords": query, "location": location}),
        },
        {
            "name": "ChileTrabajos",
            "url": "https://www.chiletrabajos.cl/encuentra-un-empleo?"
            + urlencode({"2": query, "3": location}),
        },
        {
            "name": "Employer careers",
            "url": "https://www.google.com/search?"
            + urlencode(
                {
                    "q": f"{query} {location} (site:jobs.lever.co OR site:job-boards.greenhouse.io OR site:careers.smartrecruiters.com)"
                }
            ),
        },
        {
            "name": "Local recruitment",
            "url": "https://www.google.com/search?"
            + urlencode(
                {
                    "q": f"{query} {location} (site:trabajando.cl OR site:michaelpage.cl OR site:robertwalters.cl)"
                }
            ),
        },
    ]
