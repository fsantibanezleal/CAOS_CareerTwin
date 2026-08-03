"""Durable execution service for queued, retryable and cancelable bounded agent runs."""

from __future__ import annotations

from typing import Any

from sqlalchemy import select, text
from sqlalchemy.orm import Session, selectinload

from careertwin.agent.contracts import AgentContext
from careertwin.agent.providers import provider_registry
from careertwin.agent.workflow import run_workflow
from careertwin.config import get_settings
from careertwin.database import SessionLocal
from careertwin.models import (
    AgentMessage,
    AgentRun,
    ClaimState,
    EvidenceClaim,
    MatchRun,
    ProposedChange,
    User,
    Workspace,
    utcnow,
)
from careertwin.services.audit import record_audit
from careertwin.services.tracing import emit_agent_trace, persist_agent_trace, trace_payload


def _tenant(db: Session, workspace_id: str) -> None:
    """Apply the PostgreSQL tenant context before reading or writing run state."""
    if db.bind is not None and db.bind.dialect.name == "postgresql":
        db.execute(
            text("SELECT set_config('app.workspace_id', :workspace_id, true)"),
            {"workspace_id": workspace_id},
        )


def _context(db: Session, run: AgentRun) -> tuple[AgentContext, User, int]:
    """Reconstruct one bounded turn from persisted visible state and confirmed evidence."""
    workspace = db.scalar(
        select(Workspace)
        .options(selectinload(Workspace.owner))
        .where(Workspace.id == run.workspace_id)
    )
    if not workspace:
        raise LookupError("WorkspaceNotFound")
    message_id = str(run.state.get("message_id", ""))
    message = db.scalar(
        select(AgentMessage).where(
            AgentMessage.id == message_id,
            AgentMessage.workspace_id == run.workspace_id,
            AgentMessage.conversation_id == run.conversation_id,
            AgentMessage.role == "user",
        )
    )
    if not message:
        raise LookupError("AgentMessageNotFound")
    claims = list(
        db.scalars(
            select(EvidenceClaim)
            .where(
                EvidenceClaim.workspace_id == run.workspace_id,
                EvidenceClaim.state == ClaimState.CONFIRMED,
            )
            .limit(100)
        ).all()
    )
    evidence = [
        {
            "id": claim.id,
            "statement": claim.statement,
            "claim_type": claim.claim_type,
            "source_id": claim.source_id,
            "source_locator": claim.source_locator,
        }
        for claim in claims
    ]
    opportunity_id = run.state.get("opportunity_id")
    match: dict[str, Any] | None = None
    if isinstance(opportunity_id, str) and opportunity_id:
        latest = db.scalar(
            select(MatchRun)
            .where(
                MatchRun.workspace_id == run.workspace_id,
                MatchRun.opportunity_id == opportunity_id,
            )
            .order_by(MatchRun.created_at.desc())
        )
        if latest:
            match = {
                "score": latest.score,
                "coverage": latest.coverage,
                "eligibility": latest.eligibility,
                "assessments": latest.assessments,
            }
    return (
        AgentContext(
            question=message.content,
            opportunity_id=opportunity_id if isinstance(opportunity_id, str) else None,
            evidence=evidence,
            match=match,
            locale="es" if workspace.owner.locale == "es" else "en",
        ),
        workspace.owner,
        len(evidence),
    )


def execute_agent_run(workspace_id: str, run_id: str) -> dict[str, object]:
    """Execute a persisted run with commit boundaries that make cancellation observable."""
    settings = get_settings()
    with SessionLocal.begin() as db:
        _tenant(db, workspace_id)
        run = db.scalar(
            select(AgentRun)
            .where(AgentRun.id == run_id, AgentRun.workspace_id == workspace_id)
            .with_for_update()
        )
        if not run:
            return {"status": "not-found"}
        if run.status == "cancelled" or run.cancel_requested_at:
            run.status = "cancelled"
            run.finished_at = utcnow()
            return {"status": "cancelled"}
        if run.status not in {"queued", "retrying", "claimed"}:
            return {"status": run.status}
        context, _, evidence_count = _context(db, run)
        provider = provider_registry(settings).get(run.provider)
        if not provider:
            run.status = "failed"
            run.error_code = "ProviderNotConfigured"
            run.finished_at = utcnow()
            return {"status": "failed", "error_code": run.error_code}
        run.status = "running"
        run.started_at = utcnow()
        run.state = {**run.state, "phase": "provider", "evidence_count": evidence_count}

    try:
        draft = run_workflow(provider, context)
    except Exception as exc:
        with SessionLocal.begin() as db:
            _tenant(db, workspace_id)
            run = db.scalar(
                select(AgentRun)
                .where(AgentRun.id == run_id, AgentRun.workspace_id == workspace_id)
                .with_for_update()
            )
            if run:
                run.status = "failed"
                run.error_code = type(exc).__name__
                run.state = {**run.state, "phase": "failed"}
                run.finished_at = utcnow()
                payload = trace_payload(
                    run_id=run.id,
                    workspace_id=workspace_id,
                    provider=run.provider,
                    specialist=run.specialist,
                    status=run.status,
                    input_digest=run.input_digest,
                    evidence_count=int(run.state.get("evidence_count", 0)),
                    citation_count=0,
                    attempt=run.attempt,
                )
                persist_agent_trace(db, workspace_id, run.id, payload)
            else:
                payload = None
        if payload:
            emit_agent_trace(settings, payload)
        return {"status": "failed", "error_code": type(exc).__name__}

    with SessionLocal.begin() as db:
        _tenant(db, workspace_id)
        run = db.scalar(
            select(AgentRun)
            .where(AgentRun.id == run_id, AgentRun.workspace_id == workspace_id)
            .with_for_update()
        )
        if not run:
            return {"status": "not-found"}
        if run.cancel_requested_at or run.status == "cancelled":
            run.status = "cancelled"
            run.state = {**run.state, "phase": "cancelled"}
            run.finished_at = utcnow()
            return {"status": "cancelled"}
        _, actor, evidence_count = _context(db, run)
        citations = [item.model_dump() for item in draft.citations]
        usage = provider.usage()
        assistant = AgentMessage(
            workspace_id=workspace_id,
            conversation_id=run.conversation_id,
            role="assistant",
            content=draft.answer,
            specialist=draft.specialist,
            provider=run.provider,
            citations=citations,
            usage=usage,
        )
        db.add(assistant)
        db.flush()
        proposed = None
        if draft.proposed_operations:
            proposed = ProposedChange(
                workspace_id=workspace_id,
                conversation_id=run.conversation_id,
                target_type="professional_profile",
                target_id=actor.workspace.profile.id,
                operations=[item.model_dump(mode="json") for item in draft.proposed_operations],
                evidence_ids=[item.evidence_id for item in draft.citations],
            )
            db.add(proposed)
            db.flush()
        run.status = "completed"
        run.specialist = draft.specialist
        run.state = {
            **run.state,
            "phase": "completed",
            "message_id": run.state.get("message_id"),
            "assistant_message_id": assistant.id,
            "proposed_change_id": proposed.id if proposed else None,
            "citations": len(citations),
        }
        run.finished_at = utcnow()
        record_audit(
            db,
            actor,
            "agent.queued_turn_completed",
            "agent_run",
            run.id,
            {"provider": run.provider, "specialist": draft.specialist},
        )
        payload = trace_payload(
            run_id=run.id,
            workspace_id=workspace_id,
            provider=run.provider,
            specialist=run.specialist,
            status=run.status,
            input_digest=run.input_digest,
            evidence_count=evidence_count,
            citation_count=len(citations),
            attempt=run.attempt,
        )
        persist_agent_trace(db, workspace_id, run.id, payload)
    traced = emit_agent_trace(settings, payload)
    return {"status": "completed", "message_id": assistant.id, "traced": traced}
