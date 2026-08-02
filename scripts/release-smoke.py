"""Run a synthetic, self-cleaning CareerTwin release journey against a live deployment.

Credentials are accepted only through environment variables. The harness creates a
temporary seeker through an existing superuser, exercises tenant features, and purges
the temporary seeker in a ``finally`` block. It never prints passwords or bearer tokens.
"""

from __future__ import annotations

import argparse
import io
import json
import os
import time
import zipfile
from typing import Any

import httpx


def _expect(response: httpx.Response, *statuses: int) -> httpx.Response:
    """Return a response with an expected status or raise a bounded diagnostic."""
    if response.status_code not in statuses:
        detail = response.text[:500].replace("\n", " ")
        raise RuntimeError(
            f"{response.request.method} {response.request.url.path} returned "
            f"{response.status_code}: {detail}"
        )
    return response


def _login(client: httpx.Client, email: str, password: str) -> str:
    """Authenticate and return the CSRF token while retaining the opaque cookie."""
    response = _expect(
        client.post("/api/auth/login", json={"email": email, "password": password}),
        200,
    )
    token = str(response.json()["csrf_token"])
    if not token:
        raise RuntimeError("Login returned an empty CSRF token")
    return token


def _csrf(token: str) -> dict[str, str]:
    """Build the mutation header without logging the token."""
    return {"X-CSRF-Token": token}


def _poll_json(
    client: httpx.Client,
    path: str,
    predicate: Any,
    *,
    timeout: float = 240.0,
) -> dict[str, Any]:
    """Poll one authenticated resource until its payload satisfies ``predicate``."""
    deadline = time.monotonic() + timeout
    latest: dict[str, Any] = {}
    while time.monotonic() < deadline:
        response = _expect(client.get(path), 200)
        payload = response.json()
        if isinstance(payload, dict):
            latest = payload
            if predicate(payload):
                return payload
        time.sleep(1.0)
    raise RuntimeError(f"Timed out waiting for {path}; latest={json.dumps(latest)[:300]}")


def _arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default=os.getenv("CAREERTWIN_SMOKE_BASE_URL"))
    parser.add_argument("--admin-email", default=os.getenv("CAREERTWIN_SMOKE_ADMIN_EMAIL"))
    parser.add_argument(
        "--admin-password", default=os.getenv("CAREERTWIN_SMOKE_ADMIN_PASSWORD")
    )
    parser.add_argument("--seeker-email", default=os.getenv("CAREERTWIN_SMOKE_SEEKER_EMAIL"))
    parser.add_argument(
        "--seeker-password", default=os.getenv("CAREERTWIN_SMOKE_SEEKER_PASSWORD")
    )
    args = parser.parse_args()
    missing = [
        name
        for name, value in (
            ("base URL", args.base_url),
            ("admin email", args.admin_email),
            ("admin password", args.admin_password),
            ("seeker email", args.seeker_email),
            ("seeker password", args.seeker_password),
        )
        if not value
    ]
    if missing:
        parser.error("missing " + ", ".join(missing))
    return args


def run(args: argparse.Namespace) -> dict[str, Any]:
    """Execute the release journey and return non-sensitive evidence counters."""
    timeout = httpx.Timeout(30.0, connect=10.0)
    admin = httpx.Client(base_url=args.base_url, timeout=timeout, follow_redirects=False)
    seeker = httpx.Client(base_url=args.base_url, timeout=timeout, follow_redirects=False)
    seeker_id: str | None = None
    summary: dict[str, Any] = {}
    admin_csrf = _login(admin, args.admin_email, args.admin_password)
    try:
        created = _expect(
            admin.post(
                "/api/admin/users",
                headers=_csrf(admin_csrf),
                json={
                    "email": args.seeker_email,
                    "display_name": "Release Smoke Seeker",
                    "temporary_password": args.seeker_password,
                    "locale": "en",
                    "is_superuser": False,
                },
            ),
            201,
        ).json()
        seeker_id = str(created["id"])
        seeker_csrf = _login(seeker, args.seeker_email, args.seeker_password)

        profile = _expect(seeker.get("/api/profile"), 200).json()
        _expect(
            seeker.put(
                "/api/profile",
                headers=_csrf(seeker_csrf),
                json={
                    "revision": profile["revision"],
                    "headline": "Evidence-first platform engineer",
                    "summary": "Builds typed Python services and reliable data systems.",
                    "location": "Santiago",
                    "seniority": "senior",
                    "years_experience": 8,
                    "availability": "open",
                    "preferences": {"remote": True},
                    "links": [{"label": "portfolio", "url": "https://example.com"}],
                },
            ),
            200,
        )
        claim = _expect(
            seeker.post(
                "/api/profile/claims",
                headers=_csrf(seeker_csrf),
                json={
                    "claim_type": "achievement",
                    "statement": "Delivered Python APIs for eight years.",
                    "normalized_value": {"years": 8},
                    "confidence": 0.95,
                },
            ),
            201,
        ).json()
        _expect(
            seeker.post(
                f"/api/profile/claims/{claim['id']}/decision",
                headers=_csrf(seeker_csrf),
                json={"decision": "confirmed", "note": "Synthetic release evidence"},
            ),
            200,
        )
        _expect(
            seeker.post(
                "/api/profile/skills",
                headers=_csrf(seeker_csrf),
                json={
                    "name": "Python",
                    "level": 0.9,
                    "years": 8,
                    "confidence": 0.95,
                    "evidence_ids": [claim["id"]],
                },
            ),
            201,
        )

        source = _expect(
            seeker.post(
                "/api/profile/sources/upload",
                headers=_csrf(seeker_csrf),
                data={"label": "Synthetic release resume"},
                files={
                    "file": (
                        "release-resume.txt",
                        b"Python platform engineer. Led typed API and PostgreSQL delivery.",
                        "text/plain",
                    )
                },
            ),
            201,
        ).json()
        source_id = str(source["id"])
        deadline = time.monotonic() + 240.0
        source_state = "pending"
        while time.monotonic() < deadline:
            sources = _expect(seeker.get("/api/profile/sources"), 200).json()
            record = next(item for item in sources if item["id"] == source_id)
            source_state = str(record["status"])
            if source_state in {"ready", "failed"}:
                break
            time.sleep(1.0)
        if source_state != "ready":
            raise RuntimeError(f"Durable profile extraction ended as {source_state}")

        opportunity = _expect(
            seeker.post(
                "/api/opportunities",
                headers=_csrf(seeker_csrf),
                json={
                    "title": "Senior Platform Engineer",
                    "employer": "Synthetic Systems",
                    "description": "Python is required; Kubernetes is preferred.",
                    "source_kind": "paste",
                    "industry": "Software",
                    "area": "Platform",
                    "seniority": "senior",
                    "location": "Remote",
                    "remote_mode": "remote",
                    "deadline_at": "2026-09-01T00:00:00Z",
                    "status": "active",
                    "requirements": [
                        {
                            "category": "skill",
                            "label": "Python",
                            "importance": "required",
                            "minimum_level": 0.8,
                        },
                        {
                            "category": "skill",
                            "label": "Kubernetes",
                            "importance": "preferred",
                        },
                    ],
                },
            ),
            201,
        ).json()
        opportunity_id = str(opportunity["id"])
        match = _expect(
            seeker.post(
                f"/api/matches/{opportunity_id}/run", headers=_csrf(seeker_csrf)
            ),
            201,
        ).json()
        recommendations = _expect(
            seeker.post(
                f"/api/matches/{opportunity_id}/recommendations",
                headers=_csrf(seeker_csrf),
            ),
            200,
        ).json()
        _expect(
            seeker.post(
                "/api/artifacts",
                headers=_csrf(seeker_csrf),
                json={
                    "kind": "resume",
                    "title": "Platform resume",
                    "opportunity_id": opportunity_id,
                    "evidence_ids": [claim["id"]],
                },
            ),
            201,
        )

        application = _expect(
            seeker.post(
                "/api/pipeline/applications",
                headers=_csrf(seeker_csrf),
                json={"opportunity_id": opportunity_id, "channel": "community"},
            ),
            201,
        ).json()
        for stage in ("preparing", "applied", "screening", "interview"):
            _expect(
                seeker.post(
                    f"/api/pipeline/applications/{application['id']}/stage",
                    headers=_csrf(seeker_csrf),
                    json={"stage": stage, "note": "Synthetic release transition"},
                ),
                200,
            )
        _expect(
            seeker.post(
                "/api/pipeline/tasks",
                headers=_csrf(seeker_csrf),
                json={
                    "application_id": application["id"],
                    "kind": "meeting",
                    "title": "Synthetic interview",
                    "starts_at": "2026-08-10T15:00:00Z",
                    "due_at": "2026-08-10T16:00:00Z",
                },
            ),
            201,
        )
        calendar = _expect(seeker.get("/api/pipeline/calendar.ics"), 200)
        if b"BEGIN:VCALENDAR" not in calendar.content:
            raise RuntimeError("Pipeline calendar export is not an iCalendar document")

        extension = _expect(seeker.get("/api/connectors/browser/extension.zip"), 200)
        with zipfile.ZipFile(io.BytesIO(extension.content)) as archive:
            if "manifest.json" not in archive.namelist():
                raise RuntimeError("Browser extension archive is missing manifest.json")
        credential = _expect(
            seeker.post(
                "/api/connectors/browser/credentials",
                headers=_csrf(seeker_csrf),
                json={"label": "Release smoke browser", "expires_in_days": 1},
            ),
            201,
        ).json()
        raw_token = str(credential["token"])
        captured = _expect(
            seeker.post(
                "/api/connectors/browser/capture",
                headers={"Authorization": f"Bearer {raw_token}"},
                json={
                    "url": "https://jobs.example/release-smoke",
                    "title": "Synthetic Browser Opportunity",
                    "content": "Python is required. PostgreSQL experience is preferred.",
                    "captured_at": "2026-08-02T12:00:00Z",
                },
            ),
            202,
        ).json()
        captured_opportunity = _poll_json(
            seeker,
            f"/api/opportunities/{captured['opportunity_id']}",
            lambda item: item.get("structured_data", {}).get("capture_status") == "ready",
        )
        _expect(
            seeker.delete(
                f"/api/connectors/browser/credentials/{credential['id']}",
                headers=_csrf(seeker_csrf),
            ),
            204,
        )
        _expect(
            seeker.post(
                "/api/connectors/browser/capture",
                headers={"Authorization": f"Bearer {raw_token}"},
                json={
                    "url": "https://jobs.example/revoked",
                    "title": "Revoked",
                    "content": "This must be rejected.",
                    "captured_at": "2026-08-02T12:00:00Z",
                },
            ),
            401,
        )

        providers = _expect(seeker.get("/api/agent/providers"), 200).json()
        provider = "ollama" if "ollama" in providers["providers"] else providers["default"]
        queued = _expect(
            seeker.post(
                "/api/agent/runs",
                headers=_csrf(seeker_csrf),
                json={
                    "message": "Provide one evidence-cited improvement for this opportunity.",
                    "provider": provider,
                    "opportunity_id": opportunity_id,
                },
            ),
            201,
        ).json()
        cancel = seeker.post(
            f"/api/agent/runs/{queued['id']}/cancel", headers=_csrf(seeker_csrf)
        )
        if cancel.status_code == 200:
            cancelled = _poll_json(
                seeker,
                f"/api/agent/runs/{queued['id']}",
                lambda item: item.get("status") in {"cancelled", "completed", "failed"},
            )
        elif cancel.status_code == 409:
            cancelled = _expect(
                seeker.get(f"/api/agent/runs/{queued['id']}"), 200
            ).json()
        else:
            _expect(cancel, 200, 409)
            raise AssertionError("unreachable")
        terminal = cancelled
        if cancelled["status"] == "cancelled":
            retry = _expect(
                seeker.post(
                    f"/api/agent/runs/{queued['id']}/retry", headers=_csrf(seeker_csrf)
                ),
                201,
            ).json()
            terminal = _poll_json(
                seeker,
                f"/api/agent/runs/{retry['id']}",
                lambda item: item.get("status") in {"completed", "failed", "cancelled"},
                timeout=360.0,
            )
        if terminal["status"] != "completed":
            raise RuntimeError(
                f"Durable agent execution ended as {terminal['status']}: "
                f"{terminal.get('error_code')}"
            )
        trace = _expect(
            seeker.get(f"/api/agent/runs/{terminal['id']}/trace"), 200
        ).json()
        forbidden_trace_fields = {
            "prompt",
            "messages",
            "input",
            "output",
            "answer",
            "evidence",
        }
        if forbidden_trace_fields.intersection(trace):
            raise RuntimeError("Agent trace exposed a forbidden content field")
        if len(str(trace.get("input_digest", ""))) != 64:
            raise RuntimeError("Agent trace omitted its redacted input digest")

        graph = _expect(seeker.get("/api/profile/graph"), 200).json()
        graph_nodes = len(graph.get("graph", {}).get("nodes", []))
        if graph_nodes < 2:
            raise RuntimeError("Profile graph omitted the confirmed skill/evidence network")
        landscape = _expect(
            seeker.get("/api/opportunities/visualization/landscape"), 200
        ).json()
        today = _expect(seeker.get("/api/workspace/today"), 200).json()
        summary = {
            "profile_source": source_state,
            "profile_graph_nodes": graph_nodes,
            "match_score": match.get("score"),
            "recommendations": len(recommendations),
            "landscape_denominator": landscape.get("denominator"),
            "pipeline_stage": "interview",
            "calendar": "valid",
            "browser_capture": captured_opportunity["structured_data"]["capture_status"],
            "browser_revocation": "enforced",
            "agent_provider": terminal["provider"],
            "agent_status": terminal["status"],
            "trace_contract": "redacted-fields-only",
            "today_active_opportunities": today.get("active_opportunities"),
        }
        return summary
    finally:
        if seeker_id:
            response = admin.delete(
                f"/api/admin/users/{seeker_id}",
                params={"confirm": args.seeker_email},
                headers=_csrf(admin_csrf),
            )
            _expect(response, 204)
        seeker.close()
        admin.close()


def main() -> None:
    """CLI entry point that prints only non-sensitive verification evidence."""
    print(json.dumps(run(_arguments()), indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
