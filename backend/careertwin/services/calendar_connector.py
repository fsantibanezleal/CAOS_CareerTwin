"""Consent-bound Google and Microsoft calendar synchronization.

The connector mirrors only CareerTwin tasks and events inside the requested time
window.  Remote identifiers are stored on the tenant-owned task so retries update
instead of duplicating events.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import quote

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from careertwin.config import Settings
from careertwin.models import CareerTask, ExternalConnection, utcnow
from careertwin.services.oauth import access_token


def _iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    aware = value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)
    return aware.isoformat().replace("+00:00", "Z")


def _parse_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed.replace(tzinfo=UTC) if parsed.tzinfo is None else parsed.astimezone(UTC)


def _career_event(task: CareerTask) -> dict[str, Any]:
    start = task.starts_at or task.due_at
    end = task.due_at if task.due_at and task.due_at != start else None
    if start is None:
        raise ValueError("Only scheduled tasks can be synchronized")
    if end is None or end <= start:
        end = start + timedelta(minutes=30)
    return {
        "summary": task.title,
        "description": task.notes,
        "start": {"dateTime": _iso(start), "timeZone": "UTC"},
        "end": {"dateTime": _iso(end), "timeZone": "UTC"},
        "extendedProperties": {"private": {"careertwinTaskId": task.id}},
    }


def _microsoft_event(task: CareerTask) -> dict[str, Any]:
    event = _career_event(task)
    return {
        "subject": event["summary"],
        "body": {"contentType": "text", "content": event["description"]},
        "start": {"dateTime": str(event["start"]["dateTime"]).removesuffix("Z"), "timeZone": "UTC"},
        "end": {"dateTime": str(event["end"]["dateTime"]).removesuffix("Z"), "timeZone": "UTC"},
        "singleValueExtendedProperties": [
            {
                "id": "String {66f5a359-4659-4830-9070-00040ec6ac6e} Name careertwinTaskId",
                "value": task.id,
            }
        ],
    }


def _headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}", "Accept": "application/json"}


def sync_calendar(
    db: Session,
    settings: Settings,
    connection: ExternalConnection,
    *,
    calendar_id: str | None,
    days_back: int,
    days_forward: int,
) -> dict[str, int | str]:
    """Push local scheduled tasks and import external events idempotently."""
    if "calendar" not in set(connection.connection_metadata.get("services", [])):
        raise ValueError("This connection was not authorized for calendar access")
    token = access_token(db, settings, connection)
    start = utcnow() - timedelta(days=days_back)
    end = utcnow() + timedelta(days=days_forward)
    tasks = list(
        db.scalars(
            select(CareerTask).where(
                CareerTask.workspace_id == connection.workspace_id,
                CareerTask.completed_at.is_(None),
                CareerTask.starts_at.is_not(None) | CareerTask.due_at.is_not(None),
            )
        ).all()
    )
    timeout = settings.connector_sync_timeout_seconds
    pushed = updated = imported = skipped = 0
    with httpx.Client(timeout=timeout, follow_redirects=False, headers=_headers(token)) as client:
        if connection.provider == "google":
            resource = calendar_id or connection.selected_resource or "primary"
            base = f"https://www.googleapis.com/calendar/v3/calendars/{quote(resource, safe='')}/events"
            for task in tasks:
                remote_id = str(task.contact.get("google_event_id") or "")
                response = (
                    client.put(f"{base}/{quote(remote_id, safe='')}", json=_career_event(task))
                    if remote_id
                    else client.post(base, json=_career_event(task))
                )
                response.raise_for_status()
                task.contact = {**task.contact, "google_event_id": str(response.json()["id"])}
                updated += int(bool(remote_id))
                pushed += int(not remote_id)
            response = client.get(
                base,
                params={
                    "timeMin": _iso(start),
                    "timeMax": _iso(end),
                    "singleEvents": "true",
                    "maxResults": 1000,
                    "orderBy": "startTime",
                },
            )
            response.raise_for_status()
            remote_events = response.json().get("items", [])
            connection.selected_resource = resource
        elif connection.provider == "microsoft":
            base = "https://graph.microsoft.com/v1.0/me/calendar/events"
            for task in tasks:
                remote_id = str(task.contact.get("microsoft_event_id") or "")
                endpoint = f"{base}/{quote(remote_id, safe='')}" if remote_id else base
                response = (
                    client.patch(endpoint, json=_microsoft_event(task))
                    if remote_id
                    else client.post(endpoint, json=_microsoft_event(task))
                )
                response.raise_for_status()
                task.contact = {**task.contact, "microsoft_event_id": str(response.json()["id"])}
                updated += int(bool(remote_id))
                pushed += int(not remote_id)
            response = client.get(
                "https://graph.microsoft.com/v1.0/me/calendarView",
                params={
                    "startDateTime": _iso(start),
                    "endDateTime": _iso(end),
                    "$top": 1000,
                    "$select": "id,subject,bodyPreview,start,end,isCancelled,webLink",
                },
            )
            response.raise_for_status()
            remote_events = response.json().get("value", [])
            connection.selected_resource = "default"
        else:
            raise ValueError("Unsupported calendar provider")

    known = {
        str(value)
        for task in tasks
        for key, value in task.contact.items()
        if key in {"google_event_id", "microsoft_event_id"}
    }
    for event in remote_events:
        remote_id = str(event.get("id") or "")
        if (
            not remote_id
            or remote_id in known
            or event.get("status") == "cancelled"
            or event.get("isCancelled")
        ):
            skipped += 1
            continue
        if connection.provider == "google":
            title = str(event.get("summary") or "Calendar event")[:300]
            notes = str(event.get("description") or "")[:10_000]
            starts_at = _parse_datetime(event.get("start", {}).get("dateTime"))
            due_at = _parse_datetime(event.get("end", {}).get("dateTime"))
            contact = {"google_event_id": remote_id, "calendar_link": event.get("htmlLink")}
        else:
            title = str(event.get("subject") or "Calendar event")[:300]
            notes = str(event.get("bodyPreview") or "")[:10_000]
            starts_at = _parse_datetime(event.get("start", {}).get("dateTime"))
            due_at = _parse_datetime(event.get("end", {}).get("dateTime"))
            contact = {"microsoft_event_id": remote_id, "calendar_link": event.get("webLink")}
        db.add(
            CareerTask(
                workspace_id=connection.workspace_id,
                kind="meeting",
                title=title,
                notes=notes,
                starts_at=starts_at,
                due_at=due_at or starts_at,
                contact=contact,
            )
        )
        imported += 1
    connection.last_synced_at = utcnow()
    connection.status = "connected"
    return {
        "provider": connection.provider,
        "pushed": pushed,
        "updated": updated,
        "imported": imported,
        "skipped": skipped,
    }
