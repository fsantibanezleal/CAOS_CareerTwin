"""Explicit, bounded GitHub, calendar, email, and browser connector endpoints."""

from __future__ import annotations

import hashlib
import io
import secrets
import zipfile
from datetime import UTC, timedelta
from pathlib import Path

import httpx
from fastapi import APIRouter, Header, HTTPException, status
from fastapi.responses import RedirectResponse, StreamingResponse
from sqlalchemy import select, text

from careertwin.api.dependencies import Config, CsrfUser, CurrentUser, Db
from careertwin.models import (
    BrowserCaptureCredential,
    EmailThread,
    EvidenceClaim,
    ExternalConnection,
    Opportunity,
    Source,
    SourceStatus,
    utcnow,
)
from careertwin.schemas import (
    BrowserCapture,
    BrowserCredentialCreate,
    BrowserCredentialIssued,
    BrowserCredentialRead,
    CalendarSyncRequest,
    ConnectionAuthorizeRequest,
    ConnectionRead,
    EmailSyncRequest,
    EmailThreadRead,
    GithubSnapshot,
    GithubSnapshotRequest,
)
from careertwin.services.audit import record_audit
from careertwin.services.blob import configured_blob_store
from careertwin.services.calendar_connector import sync_calendar
from careertwin.services.email_connector import sync_email
from careertwin.services.github_connector import GithubConnectorError, snapshot_github
from careertwin.services.ingestion import inspect_content
from careertwin.services.oauth import (
    complete_authorization,
    configured_oauth_providers,
    start_authorization,
)
from careertwin.services.queue import enqueue_source

router = APIRouter(prefix="/api/connectors", tags=["connectors"])


def _connection(db: Db, workspace_id: str, connection_id: str) -> ExternalConnection:
    item = db.scalar(
        select(ExternalConnection).where(
            ExternalConnection.id == connection_id,
            ExternalConnection.workspace_id == workspace_id,
        )
    )
    if not item:
        raise HTTPException(status_code=404, detail="Connection not found")
    return item


@router.get("/status")
def connector_status(user: CurrentUser, db: Db, settings: Config) -> dict[str, object]:
    """Report connector configuration and this seeker's grants without secret material."""
    connections = db.scalars(
        select(ExternalConnection)
        .where(ExternalConnection.workspace_id == user.workspace.id)
        .order_by(ExternalConnection.created_at.desc())
    ).all()
    credentials = db.scalars(
        select(BrowserCaptureCredential)
        .where(BrowserCaptureCredential.workspace_id == user.workspace.id)
        .order_by(BrowserCaptureCredential.created_at.desc())
    ).all()
    return {
        "oauth_providers": configured_oauth_providers(settings),
        "connections": [ConnectionRead.model_validate(item) for item in connections],
        "browser_credentials": [BrowserCredentialRead.model_validate(item) for item in credentials],
    }


@router.post("/oauth/{provider}/authorize")
def authorize_connector(
    provider: str,
    payload: ConnectionAuthorizeRequest,
    user: CsrfUser,
    db: Db,
    settings: Config,
) -> dict[str, str]:
    """Begin delegated OAuth using PKCE and explicit requested service scopes."""
    try:
        url = start_authorization(
            db,
            settings,
            user.workspace.id,
            provider,
            payload.services,
            payload.redirect_after,
        )
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    record_audit(
        db,
        user,
        "connector.authorization_started",
        "workspace",
        user.workspace.id,
        {"provider": provider, "services": payload.services},
    )
    return {"authorize_url": url}


@router.get("/oauth/{provider}/callback", response_class=RedirectResponse)
def connector_callback(
    provider: str,
    state: str,
    code: str,
    user: CurrentUser,
    db: Db,
    settings: Config,
) -> RedirectResponse:
    """Consume one-time OAuth state and return to the authenticated workspace UI."""
    try:
        _, redirect_after = complete_authorization(
            db, settings, user.workspace.id, provider, state, code
        )
    except (ValueError, httpx.HTTPError) as exc:
        raise HTTPException(status_code=422, detail="Connector authorization failed") from exc
    return RedirectResponse(url=f"{redirect_after}?connector={provider}", status_code=303)


@router.delete("/connections/{connection_id}", status_code=status.HTTP_204_NO_CONTENT)
def disconnect_connector(connection_id: str, user: CsrfUser, db: Db) -> None:
    """Delete the local encrypted grant; remote access can also be revoked at the provider."""
    item = _connection(db, user.workspace.id, connection_id)
    provider = item.provider
    db.delete(item)
    record_audit(
        db,
        user,
        "connector.disconnected",
        "external_connection",
        connection_id,
        {"provider": provider},
    )


@router.post("/connections/{connection_id}/calendar/sync")
def synchronize_calendar(
    connection_id: str,
    payload: CalendarSyncRequest,
    user: CsrfUser,
    db: Db,
    settings: Config,
) -> dict[str, int | str]:
    """Synchronize consented calendar events and local CareerTwin tasks."""
    connection = _connection(db, user.workspace.id, connection_id)
    try:
        result = sync_calendar(
            db,
            settings,
            connection,
            calendar_id=payload.calendar_id,
            days_back=payload.days_back,
            days_forward=payload.days_forward,
        )
    except (ValueError, httpx.HTTPError, KeyError) as exc:
        connection.status = "sync_failed"
        raise HTTPException(status_code=502, detail="Calendar synchronization failed") from exc
    record_audit(
        db, user, "connector.calendar_synced", "external_connection", connection.id, result
    )
    return result


@router.post("/connections/{connection_id}/email/sync")
def synchronize_email(
    connection_id: str,
    payload: EmailSyncRequest,
    user: CsrfUser,
    db: Db,
    settings: Config,
) -> dict[str, int | str]:
    """Synchronize bounded read-only recruiting threads with explicit consent."""
    connection = _connection(db, user.workspace.id, connection_id)
    try:
        result = sync_email(
            db,
            settings,
            connection,
            days_back=payload.days_back,
            max_threads=payload.max_threads,
            create_follow_up_tasks=payload.create_follow_up_tasks,
        )
    except (ValueError, httpx.HTTPError, KeyError) as exc:
        connection.status = "sync_failed"
        raise HTTPException(status_code=502, detail="Email synchronization failed") from exc
    record_audit(db, user, "connector.email_synced", "external_connection", connection.id, result)
    return result


@router.get("/email/threads", response_model=list[EmailThreadRead])
def list_email_threads(user: CurrentUser, db: Db) -> list[EmailThreadRead]:
    """List retained recruiting threads in newest-message order."""
    rows = db.scalars(
        select(EmailThread)
        .where(EmailThread.workspace_id == user.workspace.id)
        .order_by(EmailThread.last_message_at.desc())
    ).all()
    return [EmailThreadRead.model_validate(item) for item in rows]


@router.post(
    "/browser/credentials",
    response_model=BrowserCredentialIssued,
    status_code=status.HTTP_201_CREATED,
)
def issue_browser_credential(
    payload: BrowserCredentialCreate, user: CsrfUser, db: Db
) -> BrowserCredentialIssued:
    """Issue a revocable browser credential once and persist only its SHA-256 digest."""
    raw = secrets.token_urlsafe(48)
    item = BrowserCaptureCredential(
        workspace_id=user.workspace.id,
        label=payload.label,
        token_hash=hashlib.sha256(raw.encode()).hexdigest(),
        expires_at=utcnow() + timedelta(days=payload.expires_in_days),
    )
    db.add(item)
    db.flush()
    record_audit(db, user, "connector.browser_credential_issued", "browser_credential", item.id)
    return BrowserCredentialIssued(
        id=item.id, label=item.label, token=raw, expires_at=item.expires_at
    )


@router.get("/browser/extension.zip")
def download_browser_extension(_: CurrentUser) -> StreamingResponse:
    """Package the reviewed Manifest V3 source for authenticated self-hosted installation."""
    candidates = (
        Path.cwd() / "extension",
        Path(__file__).resolve().parents[3] / "extension",
    )
    extension_root = next((path for path in candidates if (path / "manifest.json").is_file()), None)
    if extension_root is None:
        raise HTTPException(status_code=503, detail="Browser extension package is unavailable")
    payload = io.BytesIO()
    with zipfile.ZipFile(payload, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(extension_root.iterdir()):
            if path.is_file() and path.suffix in {".json", ".html", ".css", ".js", ".md"}:
                archive.write(path, path.name)
    payload.seek(0)
    return StreamingResponse(
        payload,
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="careertwin-extension.zip"'},
    )


@router.delete("/browser/credentials/{credential_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_browser_credential(credential_id: str, user: CsrfUser, db: Db) -> None:
    """Revoke one tenant-owned browser credential immediately."""
    item = db.scalar(
        select(BrowserCaptureCredential).where(
            BrowserCaptureCredential.id == credential_id,
            BrowserCaptureCredential.workspace_id == user.workspace.id,
        )
    )
    if not item:
        raise HTTPException(status_code=404, detail="Browser credential not found")
    item.revoked_at = utcnow()
    record_audit(db, user, "connector.browser_credential_revoked", "browser_credential", item.id)


@router.post("/browser/capture", status_code=status.HTTP_202_ACCEPTED)
async def capture_from_browser(
    payload: BrowserCapture,
    db: Db,
    settings: Config,
    authorization: str | None = Header(default=None),
) -> dict[str, str]:
    """Accept a user-triggered page capture through a revocable extension credential."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Browser credential required")
    digest = hashlib.sha256(authorization.removeprefix("Bearer ").strip().encode()).hexdigest()
    if db.bind is not None and db.bind.dialect.name == "postgresql":
        db.execute(text("SELECT set_config('app.is_admin', 'true', true)"))
    credential = db.scalar(
        select(BrowserCaptureCredential).where(BrowserCaptureCredential.token_hash == digest)
    )
    expires_at = credential.expires_at if credential else None
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=UTC)
    if (
        not credential
        or credential.revoked_at is not None
        or (expires_at and expires_at <= utcnow())
    ):
        raise HTTPException(status_code=401, detail="Browser credential is invalid or expired")
    if db.bind is not None and db.bind.dialect.name == "postgresql":
        db.execute(
            text("SELECT set_config('app.workspace_id', :workspace_id, true)"),
            {"workspace_id": credential.workspace_id},
        )
        db.execute(text("SELECT set_config('app.is_admin', 'false', true)"))
    content = payload.content.encode("utf-8")
    inspection = inspect_content(content, "text/plain", "browser-capture.txt")
    if not inspection.safe:
        raise HTTPException(status_code=415, detail=inspection.reason)
    stored = configured_blob_store(settings).put(credential.workspace_id, content)
    source = Source(
        workspace_id=credential.workspace_id,
        kind="opportunity_document",
        label=(payload.title or str(payload.url))[:300],
        status=SourceStatus.PENDING,
        source_url=str(payload.url),
        media_type="text/plain",
        sha256=stored.sha256,
        storage_key=stored.key,
        source_metadata={
            "original_name": "browser-capture.txt",
            "captured_at": payload.captured_at.isoformat(),
            "capture_method": "browser_extension",
        },
    )
    db.add(source)
    db.flush()
    opportunity = Opportunity(
        workspace_id=credential.workspace_id,
        title=(payload.title or "Browser-captured opportunity")[:300],
        employer="",
        description="",
        source_url=str(payload.url),
        source_kind="browser_extension",
        source_sha256=stored.sha256,
        structured_data={"source_id": source.id, "capture_status": "pending"},
    )
    db.add(opportunity)
    db.flush()
    source.source_metadata = {**source.source_metadata, "opportunity_id": opportunity.id}
    credential.last_used_at = utcnow()
    db.commit()
    try:
        queued = await enqueue_source(settings, credential.workspace_id, source.id)
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail="Opportunity is stored safely but extraction could not be queued; retry it.",
        ) from exc
    return {
        "opportunity_id": opportunity.id,
        "source_id": source.id,
        "status": "queued" if queued else "already_queued",
    }


@router.post("/github/snapshot", response_model=GithubSnapshot)
def github_snapshot(payload: GithubSnapshotRequest, user: CsrfUser, db: Db) -> GithubSnapshot:
    """Use a read-only PAT for one request, persist only the bounded public portfolio snapshot."""
    try:
        result = snapshot_github(payload.token, payload.repositories)
    except GithubConnectorError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    source_ids: dict[str, str] = {}
    for repository in result["repositories"]:
        full_name = str(repository["full_name"])
        source = Source(
            workspace_id=user.workspace.id,
            kind="github",
            label=full_name,
            status=SourceStatus.READY,
            source_url=str(repository.get("html_url") or ""),
            source_metadata=repository,
        )
        db.add(source)
        db.flush()
        source_ids[full_name] = source.id
    for proposal in result["proposed_claims"]:
        repository = str(proposal.get("normalized_value", {}).get("repository", ""))
        db.add(
            EvidenceClaim(
                workspace_id=user.workspace.id,
                source_id=source_ids.get(repository),
                **proposal,
            )
        )
    record_audit(
        db,
        user,
        "connector.github_snapshot",
        "workspace",
        user.workspace.id,
        {"repositories": len(result["repositories"]), "proposals": len(result["proposed_claims"])},
    )
    return GithubSnapshot.model_validate(result)
