"""Hardened public-URL capture and JobPosting extraction."""

from __future__ import annotations

import hashlib
import ipaddress
import json
import re
import socket
from dataclasses import dataclass
from datetime import datetime
from typing import Any
from urllib.parse import urljoin, urlsplit

import httpx
from trafilatura import extract


class UnsafeUrlError(ValueError):
    """Raised when a URL could reach a non-public or unsupported target."""


def validate_public_url(url: str) -> str:
    """Reject credentials, non-HTTP schemes, local names and every non-global resolved address."""
    parsed = urlsplit(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise UnsafeUrlError("Only absolute HTTP(S) URLs are accepted")
    if parsed.username or parsed.password or parsed.port not in {None, 80, 443}:
        raise UnsafeUrlError("Credentials and non-standard ports are not accepted")
    hostname = parsed.hostname.rstrip(".").casefold()
    if hostname in {"localhost", "localhost.localdomain"} or hostname.endswith(".local"):
        raise UnsafeUrlError("Local hostnames are blocked")
    try:
        addresses = {
            item[4][0] for item in socket.getaddrinfo(hostname, None, type=socket.SOCK_STREAM)
        }
    except socket.gaierror as exc:
        raise UnsafeUrlError("Hostname could not be resolved") from exc
    if not addresses:
        raise UnsafeUrlError("Hostname did not resolve")
    for address in addresses:
        ip = ipaddress.ip_address(str(address).split("%")[0])
        if not ip.is_global:
            raise UnsafeUrlError("URL resolves to a private, local or reserved address")
    return url


@dataclass(frozen=True)
class CapturedOpportunity:
    final_url: str
    sha256: str
    title: str
    employer: str
    description: str
    structured: dict[str, Any]
    published_at: datetime | None
    deadline_at: datetime | None


def _iter_job_postings(value: Any) -> list[dict[str, Any]]:
    if isinstance(value, dict):
        found = [value] if value.get("@type") == "JobPosting" else []
        for child in value.values():
            found.extend(_iter_job_postings(child))
        return found
    if isinstance(value, list):
        return [item for child in value for item in _iter_job_postings(child)]
    return []


def _parse_datetime(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def capture_url(url: str, max_bytes: int) -> CapturedOpportunity:
    """Fetch a bounded page with each redirect target revalidated and no credential forwarding."""
    current = validate_public_url(url)
    headers = {"User-Agent": "CareerTwin/0.1 opportunity-research (+public self-hosted app)"}
    body = b""
    for _ in range(5):
        with httpx.Client(timeout=httpx.Timeout(15, connect=5), follow_redirects=False) as client:
            with client.stream("GET", current, headers=headers) as response:
                if response.status_code in {301, 302, 303, 307, 308}:
                    location = response.headers.get("location")
                    if not location:
                        raise ValueError("Redirect did not include a destination")
                    current = validate_public_url(urljoin(current, location))
                    continue
                response.raise_for_status()
                content_type = response.headers.get("content-type", "").casefold()
                if "text/html" not in content_type and "application/xhtml+xml" not in content_type:
                    raise ValueError("Opportunity URL did not return HTML")
                chunks: list[bytes] = []
                size = 0
                for chunk in response.iter_bytes():
                    size += len(chunk)
                    if size > max_bytes:
                        raise ValueError("Opportunity page exceeds the configured byte limit")
                    chunks.append(chunk)
                body = b"".join(chunks)
                break
    else:
        raise ValueError("Too many redirects")
    html = body.decode("utf-8", errors="replace")
    postings: list[dict[str, Any]] = []
    for raw in re.findall(
        r"<script[^>]+type=[\"']application/ld\+json[\"'][^>]*>(.*?)</script>",
        html,
        flags=re.IGNORECASE | re.DOTALL,
    ):
        try:
            postings.extend(_iter_job_postings(json.loads(raw)))
        except json.JSONDecodeError:
            continue
    posting = postings[0] if postings else {}
    description = str(posting.get("description") or extract(html, include_links=False) or "")
    description = re.sub(r"<[^>]+>", " ", description)
    description = " ".join(description.split())[:100_000]
    title = str(posting.get("title") or "Captured opportunity")[:300]
    organization = posting.get("hiringOrganization") or {}
    employer = str(organization.get("name", "")) if isinstance(organization, dict) else ""
    return CapturedOpportunity(
        final_url=current,
        sha256=hashlib.sha256(body).hexdigest(),
        title=title,
        employer=employer[:300],
        description=description,
        structured=posting,
        published_at=_parse_datetime(posting.get("datePosted")),
        deadline_at=_parse_datetime(posting.get("validThrough")),
    )


def propose_requirements(description: str) -> list[dict[str, Any]]:
    """Extract conservative reviewable requirement lines from a job description."""
    proposals: list[dict[str, Any]] = []
    sentences = re.split(r"(?<=[.!?])\s+|[\r\n]+|[•·]", description)
    for index, sentence in enumerate(sentences):
        cleaned = " ".join(sentence.split()).strip("-: ")
        lower = cleaned.casefold()
        if not (8 <= len(cleaned) <= 500):
            continue
        if not any(
            marker in lower
            for marker in (
                "required",
                "requirement",
                "must",
                "experience",
                "knowledge",
                "proficient",
                "degree",
                "skill",
                "familiar",
            )
        ):
            continue
        importance = (
            "required" if any(marker in lower for marker in ("required", "must")) else "preferred"
        )
        category = (
            "education"
            if any(marker in lower for marker in ("degree", "education"))
            else "experience"
            if "experience" in lower
            else "skill"
        )
        proposals.append(
            {
                "category": category,
                "label": cleaned,
                "normalized_name": cleaned,
                "importance": importance,
                "weight": 1.0 if importance == "required" else 0.6,
                "source_locator": {"sentence": index + 1},
            }
        )
        if len(proposals) >= 100:
            break
    return proposals
