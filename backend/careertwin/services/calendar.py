"""RFC 5545 calendar import/export for user-owned career tasks and meetings."""

from __future__ import annotations

from datetime import UTC, date, datetime, time
from typing import Any

from icalendar import Calendar, Event

from careertwin.models import CareerTask


def export_calendar(tasks: list[CareerTask]) -> bytes:
    """Build a portable calendar without embedding secret or hidden application state."""
    calendar = Calendar()
    calendar.add("prodid", "-//CareerTwin//Career calendar//EN")
    calendar.add("version", "2.0")
    for task in tasks:
        event = Event()
        event.add("uid", f"{task.id}@careertwin")
        event.add("summary", task.title)
        event.add("description", task.notes)
        if task.starts_at:
            event.add("dtstart", task.starts_at)
        if task.due_at:
            event.add("dtend", task.due_at)
        calendar.add_component(event)
    return calendar.to_ical()


def import_calendar(content: bytes, *, max_events: int = 1000) -> list[dict[str, Any]]:
    """Parse bounded VEVENT data into task-shaped values without executing calendar content."""
    try:
        calendar = Calendar.from_ical(content.decode("utf-8"))
    except Exception as exc:
        raise ValueError("Invalid iCalendar document") from exc
    values: list[dict[str, Any]] = []
    for component in calendar.walk("VEVENT"):
        if len(values) >= max_events:
            raise ValueError(f"Calendar exceeds the {max_events}-event limit")
        title = str(component.get("SUMMARY", "")).strip()
        if not title:
            continue
        start = _datetime_value(component.get("DTSTART"))
        end = _datetime_value(component.get("DTEND"))
        uid = str(component.get("UID", "")).strip()[:500]
        values.append(
            {
                "kind": "meeting" if start else "task",
                "title": title[:300],
                "notes": str(component.get("DESCRIPTION", ""))[:10_000],
                "starts_at": start,
                "due_at": end or start,
                "contact": {"calendar_uid": uid} if uid else {},
            }
        )
    return values


def _datetime_value(value: object) -> datetime | None:
    """Normalize icalendar date/datetime values to timezone-aware UTC datetimes."""
    decoded = getattr(value, "dt", None)
    if isinstance(decoded, datetime):
        return decoded.replace(tzinfo=UTC) if decoded.tzinfo is None else decoded.astimezone(UTC)
    if isinstance(decoded, date):
        return datetime.combine(decoded, time.min, tzinfo=UTC)
    return None
