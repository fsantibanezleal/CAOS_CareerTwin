"""Redacted audit event recording."""

from __future__ import annotations

import re
from typing import Any

from sqlalchemy.orm import Session

from careertwin.models import AuditEvent, User

SENSITIVE_KEY = re.compile(r"token|secret|password|authorization|cookie|key", re.IGNORECASE)


def redact(value: Any) -> Any:
    """Recursively remove values whose keys could carry secrets."""
    if isinstance(value, dict):
        return {
            str(key): "[REDACTED]" if SENSITIVE_KEY.search(str(key)) else redact(item)
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [redact(item) for item in value]
    return value


def record_audit(
    db: Session,
    actor: User | None,
    action: str,
    resource_type: str,
    resource_id: str | None = None,
    details: dict[str, Any] | None = None,
) -> AuditEvent:
    """Append a tenant-aware event after structural redaction."""
    event = AuditEvent(
        workspace_id=actor.workspace.id if actor and actor.workspace else None,
        actor_user_id=actor.id if actor else None,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details=redact(details or {}),
    )
    db.add(event)
    return event
