"""Privacy-preserving optional Langfuse tracing for bounded agent runs."""

from __future__ import annotations

import hashlib
from typing import Any

import structlog
from langfuse import Langfuse

from careertwin.config import Settings

log = structlog.get_logger("careertwin.tracing")


def trace_payload(
    *,
    run_id: str,
    workspace_id: str,
    provider: str,
    specialist: str | None,
    status: str,
    input_digest: str,
    evidence_count: int,
    citation_count: int,
    attempt: int,
) -> dict[str, Any]:
    """Build a low-cardinality trace that contains no prompt, evidence, output or account value."""
    return {
        "trace_id": hashlib.sha256(f"careertwin:{run_id}".encode()).hexdigest()[:32],
        "subject": hashlib.sha256(f"workspace:{workspace_id}".encode()).hexdigest(),
        "input": {"digest": input_digest, "evidence_count": evidence_count},
        "output": {
            "status": status,
            "specialist": specialist or "unknown",
            "citation_count": citation_count,
        },
        "metadata": {"provider": provider, "attempt": attempt, "contract": "redacted-v1"},
    }


def emit_agent_trace(settings: Settings, payload: dict[str, Any]) -> bool:
    """Send one redacted observation when configured; tracing can never fail an agent run."""
    if not (
        settings.langfuse_public_key and settings.langfuse_secret_key and settings.langfuse_host
    ):
        return False
    try:
        client = Langfuse(
            public_key=settings.langfuse_public_key,
            secret_key=settings.langfuse_secret_key.get_secret_value(),
            base_url=settings.langfuse_host,
            release="careertwin-redacted-v1",
            timeout=5,
        )
        with client.start_as_current_observation(
            as_type="span",
            name="careertwin.agent.run",
            trace_context={"trace_id": payload["trace_id"]},
        ) as span:
            span.update(
                input=payload["input"],
                output=payload["output"],
                metadata=payload["metadata"],
            )
        client.flush()
        return True
    except Exception as exc:
        log.warning("agent.trace_failed", error_code=type(exc).__name__)
        return False
