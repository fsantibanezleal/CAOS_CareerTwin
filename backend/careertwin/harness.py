"""Credential-safe local API harness used by repository skills and operators.

The harness talks only to an explicitly selected CareerTwin instance, accepts
passwords and connector tokens through a prompt or process environment, and
never writes them to disk.  Human-readable JSON is emitted to stdout so skills
can inspect exact API contracts without depending on the web client.
"""

from __future__ import annotations

import argparse
import getpass
import json
import mimetypes
import os
import sys
import time
from pathlib import Path
from typing import Any

import httpx


class HarnessError(RuntimeError):
    """A bounded local harness failure safe to display to the operator."""


class CareerTwinClient:
    """Authenticated CareerTwin client retaining only an in-memory session."""

    def __init__(self, base_url: str, email: str | None, password: str | None) -> None:
        self.client = httpx.Client(base_url=base_url.rstrip("/"), timeout=300, follow_redirects=False)
        self.email = email
        self.password = password
        self.csrf_token: str | None = None

    def __enter__(self) -> CareerTwinClient:
        return self

    def __exit__(self, *_: object) -> None:
        self.client.close()

    def authenticate(self) -> None:
        """Create one in-memory cookie session without echoing credentials."""
        if self.csrf_token:
            return
        email = self.email or os.getenv("CAREERTWIN_LOCAL_EMAIL") or input("CareerTwin email: ").strip()
        password = self.password or os.getenv("CAREERTWIN_LOCAL_PASSWORD") or getpass.getpass("CareerTwin password: ")
        response = self.client.post("/api/auth/login", json={"email": email, "password": password})
        self._raise(response)
        self.csrf_token = str(response.json()["csrf_token"])

    @staticmethod
    def _raise(response: httpx.Response) -> None:
        if response.is_success:
            return
        try:
            detail = response.json().get("detail", response.text[:500])
        except (ValueError, AttributeError):
            detail = response.text[:500]
        raise HarnessError(f"{response.request.method} {response.request.url.path}: HTTP {response.status_code}: {detail}")

    def request(self, method: str, path: str, **kwargs: Any) -> Any:
        """Call one relative API path with session and CSRF boundaries intact."""
        if not path.startswith("/api/") or "://" in path:
            raise HarnessError("Path must be a relative /api/... path")
        self.authenticate()
        headers = dict(kwargs.pop("headers", {}))
        if method.upper() not in {"GET", "HEAD", "OPTIONS"}:
            headers["X-CSRF-Token"] = self.csrf_token or ""
        response = self.client.request(method, path, headers=headers, **kwargs)
        self._raise(response)
        if response.status_code == 204 or not response.content:
            return {"status": "ok", "http_status": response.status_code}
        content_type = response.headers.get("content-type", "")
        return response.json() if "json" in content_type else {"text": response.text}


def _emit(value: Any) -> None:
    """Print stable UTF-8 JSON suitable for humans and skill orchestration."""
    print(json.dumps(value, ensure_ascii=False, indent=2, default=str))


def _payload(path: str) -> Any:
    """Read JSON from an explicit file or stdin marker without shell interpolation."""
    raw = sys.stdin.read() if path == "-" else Path(path).read_text(encoding="utf-8")
    return json.loads(raw)


def _form(values: list[str]) -> dict[str, str]:
    result: dict[str, str] = {}
    for value in values:
        if "=" not in value:
            raise HarnessError("Form values must use name=value")
        name, content = value.split("=", 1)
        result[name] = content
    return result


def _media_type(path: Path, requested: str | None) -> str:
    """Use an explicit media type or a conservative filename-based standard type."""
    if requested:
        return requested
    guessed, _ = mimetypes.guess_type(path.name)
    return guessed or "application/octet-stream"


def _poll_run(client: CareerTwinClient, run: dict[str, Any], timeout: int) -> dict[str, Any]:
    deadline = time.monotonic() + timeout
    current = run
    while current.get("status") in {"queued", "claimed", "retrying", "running"}:
        if time.monotonic() >= deadline:
            raise HarnessError("Agent run did not reach a terminal state before the timeout")
        time.sleep(0.5)
        current = client.request("GET", f"/api/agent/runs/{run['id']}")
    return current


def execute(args: argparse.Namespace) -> Any:
    """Execute one parsed local harness command."""
    if args.command == "doctor":
        with httpx.Client(base_url=args.url.rstrip("/"), timeout=10) as client:
            live = client.get("/api/health/live")
            ready = client.get("/api/health/ready")
            live.raise_for_status()
            ready.raise_for_status()
            return {"liveness": live.json(), "readiness": ready.json()}
    with CareerTwinClient(args.url, args.email, None) as client:
        if args.command == "get":
            return client.request("GET", args.path)
        if args.command == "request":
            return client.request(args.method, args.path, json=_payload(args.json_file) if args.json_file else None)
        if args.command == "upload":
            file_path = Path(args.file).resolve()
            with file_path.open("rb") as stream:
                return client.request(
                    args.method,
                    args.path,
                    data=_form(args.form),
                    files={args.field: (file_path.name, stream, _media_type(file_path, args.media_type))},
                )
        if args.command == "profile-graph":
            return client.request("GET", "/api/profile/graph")
        if args.command == "opportunity-graph":
            return client.request("GET", "/api/opportunities/visualization/graph")
        if args.command == "profile-upload":
            file_path = Path(args.file).resolve()
            with file_path.open("rb") as stream:
                return client.request(
                    "POST",
                    "/api/profile/sources/upload",
                    data={"label": args.label or file_path.name},
                    files={"file": (file_path.name, stream, _media_type(file_path, args.media_type))},
                )
        if args.command == "claim-decision":
            return client.request("POST", f"/api/profile/claims/{args.claim_id}/decision", json={"decision": args.decision, "note": args.note})
        if args.command == "opportunity-url":
            return client.request("POST", "/api/opportunities/capture-url", json={"url": args.source_url})
        if args.command == "opportunity-file":
            file_path = Path(args.file).resolve()
            with file_path.open("rb") as stream:
                return client.request(
                    "POST",
                    "/api/opportunities/capture-file",
                    data={"title": args.title or "", "employer": args.employer or ""},
                    files={"file": (file_path.name, stream, _media_type(file_path, args.media_type))},
                )
        if args.command == "match":
            return client.request("POST", f"/api/matches/{args.opportunity_id}/run")
        if args.command == "recommend":
            return client.request("POST", f"/api/matches/{args.opportunity_id}/recommendations")
        if args.command == "github-review":
            token = os.getenv("CAREERTWIN_GITHUB_TOKEN") or getpass.getpass("Fine-grained read-only GitHub token: ")
            return client.request("POST", "/api/connectors/github/snapshot", json={"token": token, "repositories": args.repository})
        if args.command == "chat":
            run = client.request("POST", "/api/agent/runs", json={"message": args.message, "provider": args.provider, "opportunity_id": args.opportunity_id})
            completed = _poll_run(client, run, args.timeout)
            if completed.get("status") == "completed":
                completed["messages"] = client.request("GET", f"/api/agent/conversations/{completed['conversation_id']}/messages")
            return completed
    raise HarnessError("Unknown harness command")


def parser() -> argparse.ArgumentParser:
    """Build the repository-local harness command tree."""
    root = argparse.ArgumentParser(prog="careertwin-local")
    root.add_argument("--url", default=os.getenv("CAREERTWIN_LOCAL_URL", "http://127.0.0.1:8000"))
    root.add_argument("--email", default=os.getenv("CAREERTWIN_LOCAL_EMAIL"))
    commands = root.add_subparsers(dest="command", required=True)
    commands.add_parser("doctor", help="Check native API and dependency readiness")
    get = commands.add_parser("get", help="Read any authenticated API resource")
    get.add_argument("path")
    request = commands.add_parser("request", help="Call any bounded CareerTwin API operation")
    request.add_argument("method", choices=("POST", "PUT", "PATCH", "DELETE"))
    request.add_argument("path")
    request.add_argument("--json-file", help="UTF-8 JSON file, or - for stdin")
    upload = commands.add_parser("upload", help="Upload a file to any multipart API endpoint")
    upload.add_argument("method", choices=("POST", "PUT", "PATCH"))
    upload.add_argument("path")
    upload.add_argument("--file", required=True)
    upload.add_argument("--field", default="file")
    upload.add_argument("--form", action="append", default=[])
    upload.add_argument("--media-type")
    commands.add_parser("profile-graph", help="Read the rich professional graph projection")
    commands.add_parser("opportunity-graph", help="Read the typed opportunity research graph")
    profile_upload = commands.add_parser("profile-upload", help="Stage a CV or evidence document")
    profile_upload.add_argument("--file", required=True)
    profile_upload.add_argument("--label")
    profile_upload.add_argument("--media-type")
    decision = commands.add_parser("claim-decision", help="Confirm or reject one proposed claim")
    decision.add_argument("claim_id")
    decision.add_argument("decision", choices=("confirmed", "rejected"))
    decision.add_argument("--note", default="Reviewed through repository harness")
    opportunity_url = commands.add_parser("opportunity-url", help="Capture one public job URL")
    opportunity_url.add_argument("source_url")
    opportunity_file = commands.add_parser("opportunity-file", help="Stage one job-description file")
    opportunity_file.add_argument("--file", required=True)
    opportunity_file.add_argument("--title")
    opportunity_file.add_argument("--employer")
    opportunity_file.add_argument("--media-type")
    match = commands.add_parser("match", help="Run deterministic evidence alignment")
    match.add_argument("opportunity_id")
    recommend = commands.add_parser("recommend", help="Regenerate opportunity-specific actions")
    recommend.add_argument("opportunity_id")
    github = commands.add_parser("github-review", help="Create a bounded GitHub portfolio snapshot")
    github.add_argument("--repository", action="append", default=[])
    chat = commands.add_parser("chat", help="Run and poll one external-provider agent turn")
    chat.add_argument("message")
    chat.add_argument("--provider")
    chat.add_argument("--opportunity-id")
    chat.add_argument("--timeout", type=int, default=300)
    return root


def main() -> None:
    """Run the native harness and emit bounded diagnostics on failure."""
    try:
        _emit(execute(parser().parse_args()))
    except (HarnessError, httpx.HTTPError, OSError, ValueError, json.JSONDecodeError) as exc:
        raise SystemExit(f"CareerTwin harness: {exc}") from exc


if __name__ == "__main__":
    main()
