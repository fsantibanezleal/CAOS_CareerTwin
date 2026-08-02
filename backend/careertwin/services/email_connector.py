"""Read-only recruiting email synchronization with bounded local retention."""

from __future__ import annotations

import base64
import hashlib
import re
from collections import defaultdict
from datetime import UTC, datetime, timedelta
from email.utils import getaddresses
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from careertwin.config import Settings
from careertwin.models import (
    Application,
    CareerTask,
    EmailThread,
    ExternalConnection,
    Opportunity,
    utcnow,
)
from careertwin.services.oauth import access_token

RECRUITING_QUERY = (
    'newer_than:{days}d (interview OR application OR recruiter OR recruiting OR "next steps" '
    "OR candidatura OR entrevista OR reclutador OR selección OR oferta)"
)


def _decode_websafe(value: str) -> str:
    try:
        padding = "=" * (-len(value) % 4)
        return base64.urlsafe_b64decode(value + padding).decode("utf-8", errors="replace")
    except (ValueError, UnicodeError):
        return ""


def _gmail_headers(payload: dict[str, Any]) -> dict[str, str]:
    return {
        str(item.get("name", "")).casefold(): str(item.get("value", ""))
        for item in payload.get("headers", [])
    }


def _gmail_text(payload: dict[str, Any]) -> str:
    if payload.get("mimeType") == "text/plain":
        return _decode_websafe(str(payload.get("body", {}).get("data") or ""))[:4000]
    for part in payload.get("parts", []):
        text = _gmail_text(part)
        if text:
            return text
    return ""


def _parse_epoch_ms(value: str | int | None) -> datetime | None:
    try:
        return datetime.fromtimestamp(int(value or 0) / 1000, tz=UTC)
    except (TypeError, ValueError, OSError):
        return None


def _parse_iso(value: str | None) -> datetime | None:
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed.replace(tzinfo=UTC) if parsed.tzinfo is None else parsed.astimezone(UTC)


def _latest_message_at(messages: list[dict[str, Any]]) -> datetime | None:
    values: list[datetime] = []
    for message in messages:
        raw = message.get("sent_at")
        parsed = _parse_iso(raw) if isinstance(raw, str) else None
        if parsed is not None:
            values.append(parsed)
    return max(values, default=None)


def _participants(values: list[str]) -> list[dict[str, str]]:
    unique: dict[str, dict[str, str]] = {}
    for name, email in getaddresses(values):
        canonical = email.casefold().strip()
        if canonical:
            unique[canonical] = {"name": name.strip()[:200], "email": canonical[:320]}
    return list(unique.values())[:100]


def _digest(provider: str, thread_id: str) -> str:
    return hashlib.sha256(f"{provider}:{thread_id}".encode()).hexdigest()


def _normalize(value: str) -> str:
    return " ".join(re.findall(r"[a-z0-9áéíóúñü]+", value.casefold()))


def _application_link(
    db: Session, workspace_id: str, subject: str
) -> tuple[str | None, str | None]:
    normalized = _normalize(subject)
    if not normalized:
        return None, None
    rows = db.execute(
        select(Application, Opportunity)
        .join(Opportunity, Opportunity.id == Application.opportunity_id)
        .where(Application.workspace_id == workspace_id)
    ).all()
    ranked: list[tuple[int, Application, Opportunity]] = []
    for application, opportunity in rows:
        terms = {
            term
            for term in _normalize(f"{opportunity.title} {opportunity.employer}").split()
            if len(term) >= 4
        }
        score = sum(term in normalized for term in terms)
        ranked.append((score, application, opportunity))
    if not ranked:
        return None, None
    score, application, opportunity = max(ranked, key=lambda item: item[0])
    return (application.id, opportunity.id) if score else (None, None)


def _google_threads(client: httpx.Client, days_back: int, maximum: int) -> list[dict[str, Any]]:
    listing = client.get(
        "https://gmail.googleapis.com/gmail/v1/users/me/threads",
        params={"q": RECRUITING_QUERY.format(days=days_back), "maxResults": maximum},
    )
    listing.raise_for_status()
    results: list[dict[str, Any]] = []
    for summary in listing.json().get("threads", [])[:maximum]:
        response = client.get(
            f"https://gmail.googleapis.com/gmail/v1/users/me/threads/{summary['id']}",
            params={"format": "full"},
        )
        response.raise_for_status()
        thread = response.json()
        messages: list[dict[str, Any]] = []
        participants: list[str] = []
        subject = ""
        for message in thread.get("messages", [])[-100:]:
            headers = _gmail_headers(message.get("payload", {}))
            sent_at = _parse_epoch_ms(message.get("internalDate"))
            subject = subject or headers.get("subject", "")
            participants.extend([headers.get("from", ""), headers.get("to", "")])
            messages.append(
                {
                    "id": str(message.get("id", ""))[:500],
                    "from": headers.get("from", "")[:500],
                    "to": headers.get("to", "")[:1000],
                    "sent_at": sent_at.isoformat() if sent_at else None,
                    "excerpt": (
                        _gmail_text(message.get("payload", {})) or message.get("snippet", "")
                    )[:4000],
                }
            )
        results.append(
            {
                "external_thread_id": str(thread.get("id", ""))[:500],
                "subject": subject[:500],
                "participants": _participants(participants),
                "messages": messages,
                "last_message_at": _latest_message_at(messages),
            }
        )
    return results


def _microsoft_threads(client: httpx.Client, days_back: int, maximum: int) -> list[dict[str, Any]]:
    since = (utcnow() - timedelta(days=days_back)).isoformat().replace("+00:00", "Z")
    response = client.get(
        "https://graph.microsoft.com/v1.0/me/messages",
        params={
            "$filter": f"receivedDateTime ge {since}",
            "$orderby": "receivedDateTime desc",
            "$top": min(500, maximum * 10),
            "$select": "id,conversationId,subject,from,toRecipients,receivedDateTime,bodyPreview,internetMessageId,webLink",
        },
    )
    response.raise_for_status()
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for message in response.json().get("value", []):
        searchable = _normalize(f"{message.get('subject', '')} {message.get('bodyPreview', '')}")
        if not any(
            term in searchable
            for term in (
                "interview",
                "application",
                "recruit",
                "candidat",
                "entrevista",
                "selección",
                "oferta",
            )
        ):
            continue
        grouped[str(message.get("conversationId") or message.get("id"))].append(message)
    results: list[dict[str, Any]] = []
    for thread_id, messages in list(grouped.items())[:maximum]:
        messages.sort(key=lambda item: str(item.get("receivedDateTime") or ""))
        participants: list[str] = []
        safe_messages: list[dict[str, Any]] = []
        for message in messages[-100:]:
            sender = message.get("from", {}).get("emailAddress", {})
            recipients = [item.get("emailAddress", {}) for item in message.get("toRecipients", [])]
            sender_value = f"{sender.get('name', '')} <{sender.get('address', '')}>"
            recipient_values = [
                f"{item.get('name', '')} <{item.get('address', '')}>" for item in recipients
            ]
            participants.extend([sender_value, *recipient_values])
            sent_at = _parse_iso(message.get("receivedDateTime"))
            safe_messages.append(
                {
                    "id": str(message.get("id", ""))[:500],
                    "from": sender_value[:500],
                    "to": ", ".join(recipient_values)[:1000],
                    "sent_at": sent_at.isoformat() if sent_at else None,
                    "excerpt": str(message.get("bodyPreview") or "")[:4000],
                    "web_link": str(message.get("webLink") or "")[:2000],
                }
            )
        results.append(
            {
                "external_thread_id": thread_id[:500],
                "subject": str(messages[-1].get("subject") or "")[:500],
                "participants": _participants(participants),
                "messages": safe_messages,
                "last_message_at": _latest_message_at(safe_messages),
            }
        )
    return results


def sync_email(
    db: Session,
    settings: Settings,
    connection: ExternalConnection,
    *,
    days_back: int,
    max_threads: int,
    create_follow_up_tasks: bool,
) -> dict[str, int | str]:
    """Import bounded recruiting threads and optionally create idempotent review tasks."""
    if "email" not in set(connection.connection_metadata.get("services", [])):
        raise ValueError("This connection was not authorized for email access")
    token = access_token(db, settings, connection)
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}
    with httpx.Client(
        timeout=settings.connector_sync_timeout_seconds,
        headers=headers,
        follow_redirects=False,
    ) as client:
        if connection.provider == "google":
            incoming = _google_threads(client, days_back, max_threads)
        elif connection.provider == "microsoft":
            incoming = _microsoft_threads(client, days_back, max_threads)
        else:
            raise ValueError("Unsupported email provider")
    created = updated = tasks_created = 0
    for value in incoming:
        digest = _digest(connection.provider, value["external_thread_id"])
        thread = db.scalar(
            select(EmailThread).where(
                EmailThread.workspace_id == connection.workspace_id,
                EmailThread.source_digest == digest,
            )
        )
        application_id, opportunity_id = _application_link(
            db, connection.workspace_id, value["subject"]
        )
        if thread:
            thread.subject = value["subject"]
            thread.participants = value["participants"]
            thread.messages = value["messages"]
            thread.last_message_at = value["last_message_at"]
            thread.application_id = application_id or thread.application_id
            thread.opportunity_id = opportunity_id or thread.opportunity_id
            updated += 1
        else:
            thread = EmailThread(
                workspace_id=connection.workspace_id,
                source_digest=digest,
                application_id=application_id,
                opportunity_id=opportunity_id,
                retention_until=utcnow() + timedelta(days=settings.email_retention_days),
                **value,
            )
            db.add(thread)
            db.flush()
            created += 1
        if create_follow_up_tasks:
            exists = db.scalar(
                select(CareerTask.id).where(
                    CareerTask.workspace_id == connection.workspace_id,
                    CareerTask.contact["email_thread_id"].as_string() == thread.id,
                )
            )
            if not exists:
                db.add(
                    CareerTask(
                        workspace_id=connection.workspace_id,
                        application_id=thread.application_id,
                        kind="reminder",
                        title=f"Review recruiting thread: {thread.subject}"[:300],
                        notes="Imported with your explicit read-only email consent. Review before replying.",
                        due_at=utcnow() + timedelta(days=1),
                        contact={"email_thread_id": thread.id},
                    )
                )
                tasks_created += 1
                db.flush()
    connection.last_synced_at = utcnow()
    connection.status = "connected"
    return {
        "provider": connection.provider,
        "created": created,
        "updated": updated,
        "follow_up_tasks_created": tasks_created,
    }
