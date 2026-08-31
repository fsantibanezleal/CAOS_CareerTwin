"""Durable work notification seam backed by canonical database state.

Sources and agent runs are committed as ``pending``/``queued`` rows before this
function is called.  The native worker polls those durable states, so no external
message broker is required and a missed notification cannot lose work.
"""

from __future__ import annotations

from careertwin.config import Settings


async def enqueue_source(_: Settings, __: str, ___: str) -> bool:
    """Acknowledge durable source work already committed for worker discovery."""
    return True
