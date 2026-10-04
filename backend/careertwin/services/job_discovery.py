"""Attributed public job discovery with bounded fetching and workspace-bound import tickets.

No profile export, background polling, unrestricted scraping or automatic applications.
Public previews are disposable; explicit imports use the existing private opportunity store.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import http.client
import json
import math
import re
import socket
import ssl
import threading
import time
from collections import OrderedDict
from datetime import UTC, datetime
from html.parser import HTMLParser
from typing import Any, Literal
from urllib.parse import urlencode, urlsplit

from pydantic import BaseModel, ConfigDict, Field, model_validator

from careertwin.services.opportunity_ingestion import _resolve_public_target

Provider = Literal["himalayas", "jobicy"]
HOSTS = {"himalayas": "himalayas.app", "jobicy": "jobicy.com"}
PATHS = {"himalayas": "/jobs/api/search", "jobicy": "/api/v2/remote-jobs"}
MAX_BYTES = 2 * 1024 * 1024
TTL = 900
MAX_PAGES = 32
SENIORITY = ("Entry-level", "Mid-level", "Senior", "Manager", "Director", "Executive")
EMPLOYMENT = ("Full Time", "Part Time", "Contractor", "Temporary", "Intern", "Volunteer", "Other")


class DiscoveryError(ValueError):
    """Safe message, never an upstream body or secret-bearing exception."""

    def __init__(self, message: str, status: int = 502) -> None:
        super().__init__(message)
        self.status = status


class SearchRequest(BaseModel):
    """Strict provider-specific filters; never silently ignore incompatible values."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    provider: Provider = "himalayas"
    query: str = Field(default="", max_length=160)
    country: str = Field(default="", max_length=2, pattern=r"^([A-Z]{2})?$")
    worldwide: bool = False
    seniority: str = Field(default="", max_length=30)
    employment_type: str = Field(default="", max_length=30)
    sort: Literal["recent", "relevant"] = "recent"
    page: int = Field(default=1, ge=1, le=100)
    geo: str = Field(default="", max_length=80, pattern=r"^[a-z-]*$")
    cursor: str = Field(default="", max_length=2048)

    @model_validator(mode="after")
    def provider_filters(self) -> SearchRequest:
        """Keep real geographic and continuation semantics explicit."""
        if any(ord(char) < 32 for char in self.query + self.cursor):
            raise ValueError("Search terms and cursors cannot contain control characters")
        if self.provider == "himalayas":
            if self.geo or self.cursor:
                raise ValueError("Himalayas uses country filters and numbered pages")
            if self.country and self.worldwide:
                raise ValueError("Choose a country or worldwide-only, not both")
            if self.seniority and self.seniority not in SENIORITY:
                raise ValueError("Unsupported seniority")
            if self.employment_type and self.employment_type not in EMPLOYMENT:
                raise ValueError("Unsupported employment type")
        elif (
            self.country
            or self.worldwide
            or self.seniority
            or self.employment_type
            or self.page != 1
            or self.sort != "recent"
        ):
            raise ValueError("Jobicy uses provider locations, recent ordering and cursor pages")
        return self

    def parameters(self) -> dict[str, str]:
        """Only supplied terms and public filters are sent, never seeker profile content."""
        if self.provider == "himalayas":
            values = {
                "q": self.query,
                "country": self.country,
                "worldwide": "true" if self.worldwide else "",
                "seniority": self.seniority,
                "employment_type": self.employment_type,
                "sort": self.sort,
                "page": str(self.page),
            }
        else:
            values = {"count": "20", "tag": self.query, "geo": self.geo, "cursor": self.cursor}
        return {key: value for key, value in values.items() if value}


class DiscoveredJob(BaseModel):
    """Plain-text preview; source restrictions are not inferred eligibility."""

    key: str
    provider: Provider
    provider_id: str
    source_url: str
    title: str
    employer: str
    excerpt: str
    description: str
    locations: list[str]
    timezones: list[str]
    seniority: list[str]
    employment_type: list[str]
    categories: list[str]
    salary_min: float | None = None
    salary_max: float | None = None
    currency: str = ""
    salary_period: str = ""
    published_at: datetime | None = None
    expires_at: datetime | None = None
    retrieved_at: datetime
    import_ticket: str = ""
    saved_opportunity_id: str | None = None


class SearchPage(BaseModel):
    """One provider page; an empty success is not an outage."""

    provider: Provider
    jobs: list[DiscoveredJob]
    retrieved_at: datetime
    cached: bool = False
    skipped_records: int = 0
    has_more: bool = False
    next_page: int | None = None
    next_cursor: str | None = None


class _TextParser(HTMLParser):
    """Discard executable/style text while preserving paragraph and list boundaries."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.hidden = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in {"script", "style", "template"}:
            self.hidden += 1
        if tag in {"p", "br", "li", "div", "h1", "h2", "h3", "h4"} and not self.hidden:
            self.parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style", "template"}:
            self.hidden = max(0, self.hidden - 1)
        if tag in {"p", "li", "div"} and not self.hidden:
            self.parts.append("\n")

    def handle_data(self, data: str) -> None:
        if not self.hidden:
            self.parts.append(data)


def plain_text(value: object, limit: int = 40_000) -> str:
    """Bound provider text; unexpected structures are not coerced into pseudo-content."""
    if not isinstance(value, str):
        return ""
    parser = _TextParser()
    parser.feed(value[:100_000])
    text = re.sub(r"[^\S\n]+", " ", "".join(parser.parts))
    text = re.sub(r"[\x00-\x08\x0b-\x1f\x7f]", "", text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()[:limit]


def _labels(value: object) -> list[str]:
    values = value if isinstance(value, list) else [value] if value else []
    result = []
    for item in values[:100]:
        if isinstance(item, dict):
            item = item.get("name") or item.get("alpha2")
        if isinstance(item, (str, int, float)) and not isinstance(item, bool):
            label = plain_text(str(item), 160)
            if label and label not in result:
                result.append(label)
    return result


def _date(value: object) -> datetime | None:
    try:
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            return datetime.fromtimestamp(value / 1000 if value > 100_000_000_000 else value, UTC)
        if isinstance(value, str) and value:
            date = datetime.fromisoformat(value.replace("Z", "+00:00"))
            return (date if date.tzinfo else date.replace(tzinfo=UTC)).astimezone(UTC)
    except (ValueError, OverflowError, OSError):
        pass
    return None


def _salary(value: object) -> float | None:
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        amount = float(value)
        if math.isfinite(amount) and 0 <= amount <= 1_000_000_000_000:
            return amount
    return None


def listing_url(value: object, provider: Provider) -> str:
    """Allow canonical provider links only; import never fetches arbitrary client URLs."""
    if not isinstance(value, str) or len(value) > 2000 or re.search(r"[\s\x00-\x1f\\]", value):
        raise ValueError("Invalid listing link")
    parsed = urlsplit(value)
    if (
        parsed.scheme != "https"
        or parsed.hostname != HOSTS[provider]
        or parsed.username
        or parsed.password
        or parsed.port not in {None, 443}
        or parsed.fragment
        or not parsed.path.startswith("/companies/" if provider == "himalayas" else "/jobs/")
    ):
        raise ValueError("Invalid listing link")
    return value


def normalize(raw: dict[str, Any], provider: Provider, retrieved: datetime) -> DiscoveredJob:
    """Convert observed provider shapes; missing restrictions never become worldwide."""
    him = provider == "himalayas"
    try:
        url = listing_url(raw.get("guid") if him else raw.get("url"), provider)
    except ValueError:
        if not him:
            raise
        # The documented guid may be opaque; a canonical provider application link is also safe.
        url = listing_url(raw.get("applicationLink"), provider)
    identifier = raw.get("guid") if him else raw.get("id")
    if not isinstance(identifier, (str, int)) or isinstance(identifier, bool):
        raise ValueError("Missing listing identifier")
    title = plain_text(raw.get("title" if him else "jobTitle"), 300)
    description = plain_text(raw.get("description" if him else "jobDescription"))
    if not title or not description:
        raise ValueError("Incomplete listing")
    locations = _labels(raw.get("locationRestrictions" if him else "jobGeo"))
    if him and raw.get("locationRestrictions") == []:
        locations = ["Worldwide"]
    expires = _date(raw.get("expiryDate")) if him else None
    if expires and expires <= retrieved:
        raise ValueError("Expired listing")
    return DiscoveredJob(
        key=hashlib.sha256(f"{provider}:{identifier}".encode()).hexdigest(),
        provider=provider,
        provider_id=str(identifier)[:2000],
        source_url=url,
        title=title,
        employer=plain_text(raw.get("companyName"), 300),
        excerpt=plain_text(raw.get("excerpt" if him else "jobExcerpt"), 1200),
        description=description,
        locations=locations,
        timezones=_labels(raw.get("timezoneRestrictions", raw.get("timezoneRestriction"))),
        seniority=_labels(raw.get("seniority" if him else "jobLevel")),
        employment_type=_labels(raw.get("employmentType" if him else "jobType")),
        categories=_labels(raw.get("parentCategories" if him else "jobIndustry")),
        salary_min=_salary(raw.get("minSalary" if him else "salaryMin")),
        salary_max=_salary(raw.get("maxSalary" if him else "salaryMax")),
        currency=plain_text(raw.get("currency" if him else "salaryCurrency"), 12),
        salary_period=plain_text(raw.get("salaryPeriod"), 30),
        published_at=_date(raw.get("pubDate")),
        expires_at=expires,
        retrieved_at=retrieved,
    )


def fetch_json(provider: Provider, parameters: dict[str, str]) -> dict[str, Any]:
    """GET fixed-host JSON with pinned TLS; refuse redirects, compression and oversize."""
    url = f"https://{HOSTS[provider]}{PATHS[provider]}?{urlencode(parameters)}"
    connection: http.client.HTTPConnection | None = None
    try:
        target = _resolve_public_target(url)
        for address in target.addresses[:2]:
            raw_socket: socket.socket | None = None
            try:
                raw_socket = socket.create_connection(
                    (address, 443), timeout=5
                )  # lgtm[py/full-ssrf]
                context = ssl.create_default_context()
                context.minimum_version = ssl.TLSVersion.TLSv1_2
                tls = context.wrap_socket(raw_socket, server_hostname=target.hostname)
                tls.settimeout(10)
                connection = http.client.HTTPConnection(target.hostname, 443, timeout=10)
                connection.sock = tls
                break
            except (OSError, ssl.SSLError):
                if raw_socket:
                    raw_socket.close()
        if connection is None:
            raise DiscoveryError("Job source could not be reached. Try again later.")
        connection.request(
            "GET",
            target.request_target,
            headers={
                "Host": target.hostname,
                "Accept": "application/json",
                "Accept-Encoding": "identity",
                "User-Agent": "CareerTwin job research (+https://github.com/fsantibanezleal/CAOS_CareerTwin)",
            },
        )
        response = connection.getresponse()
        if response.status == 429:
            raise DiscoveryError("Job source rate limit reached. Wait before searching again.", 429)
        if response.status != 200:
            raise DiscoveryError("Job source is unavailable. Try again later.")
        if "application/json" not in (response.getheader("content-type") or "").casefold():
            raise DiscoveryError("Job source returned an unsupported response.")
        if (response.getheader("content-encoding") or "identity").casefold() != "identity":
            raise DiscoveryError("Job source returned an unsupported response.")
        body = response.read(MAX_BYTES + 1)
        if len(body) > MAX_BYTES:
            raise DiscoveryError("Job source response exceeded the safety limit.")
        value = json.loads(body)
        if not isinstance(value, dict) or value.get("success") is False or value.get("ok") is False:
            raise DiscoveryError("Job source returned an unsupported response.")
        return value
    except DiscoveryError:
        raise
    except (ValueError, OSError, http.client.HTTPException) as exc:
        raise DiscoveryError("Job source could not be read safely. Try again later.") from exc
    finally:
        if connection:
            connection.close()


class DiscoveryCache:
    """Process-local bounded pages; private import authorization is never shared in the cache."""

    def __init__(self) -> None:
        self.pages: OrderedDict[str, tuple[float, SearchPage]] = OrderedDict()
        self.lock = threading.RLock()
        self.provider_locks = {name: threading.Lock() for name in HOSTS}
        self.last_fetch: dict[str, float] = {}
        self.locations: tuple[float, list[dict[str, str]]] | None = None
        self.location_error: tuple[float, str, int] | None = None

    def clear(self) -> None:
        """Forget disposable data for tests and explicit process lifecycle."""
        with self.lock:
            self.pages.clear()
            self.last_fetch.clear()
            self.locations = None
            self.location_error = None

    def _get(self, key: str) -> SearchPage | None:
        with self.lock:
            for old_key, (until, _) in list(self.pages.items()):
                if until <= time.monotonic():
                    del self.pages[old_key]
            if key not in self.pages:
                return None
            self.pages.move_to_end(key)
            return self.pages[key][1].model_copy(deep=True)

    def search(self, request: SearchRequest) -> tuple[str, SearchPage]:
        """Coalesce identical searches; preserve each provider's continuation semantics."""
        if request.provider == "jobicy" and request.geo:
            if request.geo not in {item["value"] for item in self.jobicy_locations()}:
                raise DiscoveryError("Choose a supported location from the source catalog.", 422)
        key = hashlib.sha256(request.model_dump_json().encode()).hexdigest()
        with self.provider_locks[request.provider]:
            cached = self._get(key)
            if cached:
                cached.cached = True
                return key, cached
            now = time.monotonic()
            with self.lock:
                if now - self.last_fetch.get(request.provider, -10) < 1:
                    raise DiscoveryError("Please wait a moment before another job search.", 429)
                self.last_fetch[request.provider] = now
            raw = fetch_json(request.provider, request.parameters())
            records = raw.get("jobs")
            if not isinstance(records, list) or len(records) > 200:
                raise DiscoveryError("Job source returned an unsupported response.")
            retrieved = datetime.now(UTC)
            jobs: list[DiscoveredJob] = []
            skipped = 0
            seen: set[str] = set()
            for record in records[:20]:
                try:
                    if not isinstance(record, dict):
                        raise ValueError("Invalid record")
                    job = normalize(record, request.provider, retrieved)
                    if job.key not in seen:
                        jobs.append(job)
                        seen.add(job.key)
                except ValueError:
                    skipped += 1
            if records and not jobs:
                raise DiscoveryError(
                    "No usable listings were returned. Check the source or retry later."
                )
            next_cursor = raw.get("nextCursor") if request.provider == "jobicy" else None
            if next_cursor is not None and (
                not isinstance(next_cursor, str)
                or len(next_cursor) > 2048
                or any(ord(char) < 32 for char in next_cursor)
            ):
                raise DiscoveryError("Job source returned an unsupported response.")
            more = bool(next_cursor)
            if request.provider == "himalayas":
                total, offset, limit = raw.get("totalCount"), raw.get("offset"), raw.get("limit")
                if (
                    not isinstance(total, int)
                    or isinstance(total, bool)
                    or total < 0
                    or not isinstance(offset, int)
                    or isinstance(offset, bool)
                    or offset < 0
                    or not isinstance(limit, int)
                    or isinstance(limit, bool)
                    or not 1 <= limit <= 20
                ):
                    raise DiscoveryError("Job source returned an unsupported response.")
                more = offset + limit < total and request.page < 100
            page = SearchPage(
                provider=request.provider,
                jobs=jobs,
                retrieved_at=retrieved,
                skipped_records=skipped,
                has_more=more,
                next_page=request.page + 1 if more and request.provider == "himalayas" else None,
                next_cursor=next_cursor,
            )
            with self.lock:
                self.pages[key] = (time.monotonic() + TTL, page)
                while len(self.pages) > MAX_PAGES:
                    self.pages.popitem(last=False)
            return key, page.model_copy(deep=True)

    def job(self, cache_key: str, job_key: str) -> DiscoveredJob:
        """Resolve still-cached server content, never an arbitrary client description."""
        page = self._get(cache_key)
        if page:
            for job in page.jobs:
                if job.key == job_key:
                    if job.expires_at and job.expires_at <= datetime.now(UTC):
                        raise DiscoveryError(
                            "This listing has expired. Search for another role.", 410
                        )
                    return job
        raise DiscoveryError("This preview expired. Search again before saving it.", 410)

    def jobicy_locations(self) -> list[dict[str, str]]:
        """Cache real provider slugs for 24 hours; never guess an unsupported country filter."""
        with self.provider_locks["jobicy"]:
            if self.locations and self.locations[0] > time.monotonic():
                return list(self.locations[1])
            if self.location_error and self.location_error[0] > time.monotonic():
                raise DiscoveryError(self.location_error[1], self.location_error[2])
            try:
                raw = fetch_json("jobicy", {"get": "locations"})
            except DiscoveryError as exc:
                self.location_error = (time.monotonic() + 30, str(exc), exc.status)
                raise
            self.location_error = None
            records = raw.get("locations")
            if not isinstance(records, list) or len(records) > 300:
                raise DiscoveryError("Job source returned an unsupported response.")
            result = []
            for record in records:
                if not isinstance(record, dict):
                    continue
                slug, name = record.get("geoSlug"), plain_text(record.get("geoName"), 80)
                if isinstance(slug, str) and re.fullmatch(r"[a-z-]{1,80}", slug) and name:
                    result.append({"value": slug, "label": name})
            if not result:
                raise DiscoveryError("Job source locations could not be loaded.")
            self.locations = (time.monotonic() + 86400, result)
            return list(result)


cache = DiscoveryCache()


def issue_ticket(workspace: str, cache_key: str, job_key: str, secret: str) -> str:
    """Sign a 15-minute reference binding approval to this workspace and exact preview."""
    payload = f"{workspace}:{cache_key}:{job_key}:{int(time.time()) + TTL}"
    encoded = base64.urlsafe_b64encode(payload.encode()).decode().rstrip("=")
    signature = hmac.new(
        secret.encode(), f"job-discovery:{encoded}".encode(), hashlib.sha256
    ).hexdigest()
    return f"{encoded}.{signature}"


def resolve_ticket(ticket: str, workspace: str, secret: str) -> DiscoveredJob:
    """Verify signature, tenant and expiry before accessing server-normalized content."""
    try:
        encoded, signature = ticket.split(".")
        expected = hmac.new(
            secret.encode(), f"job-discovery:{encoded}".encode(), hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(signature, expected):
            raise ValueError("Invalid signature")
        payload = base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4)).decode()
        owner, cache_key, job_key, expires = payload.split(":")
        if owner != workspace:
            raise DiscoveryError("This preview belongs to a different workspace.", 403)
        if int(expires) <= time.time():
            raise DiscoveryError("This preview expired. Search again before saving it.", 410)
    except DiscoveryError:
        raise
    except (ValueError, UnicodeError, TypeError) as exc:
        raise DiscoveryError("Invalid job preview. Search again before saving it.", 400) from exc
    return cache.job(cache_key, job_key)
