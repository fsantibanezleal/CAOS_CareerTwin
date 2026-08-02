"""RFC 5545 calendar export for user-owned career tasks and meetings."""

from __future__ import annotations

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
