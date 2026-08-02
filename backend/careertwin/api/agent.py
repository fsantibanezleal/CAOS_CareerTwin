"""Persistent evidence-cited chat and proposed-change approval endpoints."""

from __future__ import annotations

import hashlib
import json

from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from careertwin.agent.contracts import AgentContext
from careertwin.agent.providers import provider_registry
from careertwin.agent.workflow import run_workflow
from careertwin.api.dependencies import Config, CsrfUser, CurrentUser, Db
from careertwin.models import (
    AgentMessage,
    AgentRun,
    ClaimState,
    Conversation,
    EvidenceClaim,
    MatchRun,
    ProfessionalProfile,
    ProposedChange,
    utcnow,
)
from careertwin.schemas import ChatRequest, ChatResponse, ProposedChangeDecision
from careertwin.services.audit import record_audit

router = APIRouter(prefix="/api/agent", tags=["agentic concierge"])


@router.get("/providers")
def available_providers(_: CurrentUser, settings: Config) -> dict[str, object]:
    """List configured provider names without exposing keys or provider configuration payloads."""
    names = sorted(provider_registry(settings))
    return {"providers": names, "default": settings.llm_default_provider, "offline_available": True}


@router.post("/chat", response_model=ChatResponse)
def chat(payload: ChatRequest, user: CsrfUser, db: Db, settings: Config) -> ChatResponse:
    """Run a bounded agent turn over confirmed tenant evidence and persist only visible output."""
    conversation = None
    if payload.conversation_id:
        conversation = db.scalar(
            select(Conversation).where(
                Conversation.id == payload.conversation_id,
                Conversation.workspace_id == user.workspace.id,
            )
        )
    if not conversation:
        conversation = Conversation(workspace_id=user.workspace.id, title=payload.message[:120])
        db.add(conversation)
        db.flush()
    db.add(
        AgentMessage(
            workspace_id=user.workspace.id,
            conversation_id=conversation.id,
            role="user",
            content=payload.message,
        )
    )
    claims = db.scalars(
        select(EvidenceClaim)
        .where(
            EvidenceClaim.workspace_id == user.workspace.id,
            EvidenceClaim.state == ClaimState.CONFIRMED,
        )
        .limit(100)
    ).all()
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
    match = None
    if payload.opportunity_id:
        run = db.scalar(
            select(MatchRun)
            .where(
                MatchRun.workspace_id == user.workspace.id,
                MatchRun.opportunity_id == payload.opportunity_id,
            )
            .order_by(MatchRun.created_at.desc())
        )
        match = (
            {
                "score": run.score,
                "coverage": run.coverage,
                "eligibility": run.eligibility,
                "assessments": run.assessments,
            }
            if run
            else None
        )
    providers = provider_registry(settings)
    provider_name = payload.provider or settings.llm_default_provider
    provider = providers.get(provider_name)
    if not provider:
        raise HTTPException(status_code=400, detail="Requested provider is not configured")
    context = AgentContext(
        question=payload.message,
        opportunity_id=payload.opportunity_id,
        evidence=evidence,
        match=match,
        locale="es" if user.locale == "es" else "en",
    )
    input_digest = hashlib.sha256(
        json.dumps(
            {
                "question": payload.message,
                "opportunity_id": payload.opportunity_id,
                "evidence_ids": sorted(item["id"] for item in evidence),
                "provider": provider_name,
            },
            sort_keys=True,
        ).encode()
    ).hexdigest()
    agent_run = AgentRun(
        workspace_id=user.workspace.id,
        conversation_id=conversation.id,
        status="running",
        provider=provider_name,
        input_digest=input_digest,
        state={"phase": "provider", "evidence_count": len(evidence)},
        started_at=utcnow(),
    )
    db.add(agent_run)
    db.flush()
    try:
        draft = run_workflow(provider, context)
    except Exception as exc:
        agent_run.status = "failed"
        agent_run.error_code = type(exc).__name__
        agent_run.state = {"phase": "failed"}
        agent_run.finished_at = utcnow()
        db.commit()
        raise HTTPException(
            status_code=502, detail=f"Agent run failed safely: {type(exc).__name__}"
        ) from exc
    agent_run.status = "completed"
    agent_run.specialist = draft.specialist
    agent_run.state = {"phase": "completed", "citations": len(draft.citations)}
    agent_run.finished_at = utcnow()
    citations = [item.model_dump() for item in draft.citations]
    assistant = AgentMessage(
        workspace_id=user.workspace.id,
        conversation_id=conversation.id,
        role="assistant",
        content=draft.answer,
        specialist=draft.specialist,
        provider=provider_name,
        citations=citations,
        usage={},
    )
    db.add(assistant)
    db.flush()
    proposed = None
    if draft.proposed_operations:
        proposed = ProposedChange(
            workspace_id=user.workspace.id,
            conversation_id=conversation.id,
            target_type="professional_profile",
            target_id=user.workspace.profile.id,
            operations=[item.model_dump(mode="json") for item in draft.proposed_operations],
            evidence_ids=[item.evidence_id for item in draft.citations],
        )
        db.add(proposed)
        db.flush()
    record_audit(
        db,
        user,
        "agent.turn_completed",
        "conversation",
        conversation.id,
        {
            "provider": provider_name,
            "specialist": draft.specialist,
            "proposed_change": bool(proposed),
        },
    )
    return ChatResponse(
        conversation_id=conversation.id,
        message_id=assistant.id,
        content=assistant.content,
        specialist=draft.specialist,
        provider=provider_name,
        citations=citations,
        proposed_change_id=proposed.id if proposed else None,
        usage={},
    )


@router.get("/conversations")
def conversations(user: CurrentUser, db: Db) -> list[dict[str, object]]:
    """List tenant-owned conversations without model-internal reasoning."""
    items = db.scalars(
        select(Conversation)
        .where(Conversation.workspace_id == user.workspace.id)
        .order_by(Conversation.updated_at.desc())
    ).all()
    return [{"id": item.id, "title": item.title, "updated_at": item.updated_at} for item in items]


@router.get("/conversations/{conversation_id}/messages")
def conversation_messages(
    conversation_id: str, user: CurrentUser, db: Db
) -> list[dict[str, object]]:
    """Read visible messages and citations for one tenant-owned conversation."""
    exists = db.scalar(
        select(Conversation.id).where(
            Conversation.id == conversation_id,
            Conversation.workspace_id == user.workspace.id,
        )
    )
    if not exists:
        raise HTTPException(status_code=404, detail="Conversation not found")
    items = db.scalars(
        select(AgentMessage)
        .where(
            AgentMessage.conversation_id == conversation_id,
            AgentMessage.workspace_id == user.workspace.id,
        )
        .order_by(AgentMessage.created_at)
    ).all()
    return [
        {
            "id": item.id,
            "role": item.role,
            "content": item.content,
            "specialist": item.specialist,
            "provider": item.provider,
            "citations": item.citations,
            "usage": item.usage,
            "created_at": item.created_at,
        }
        for item in items
    ]


@router.delete("/conversations/{conversation_id}", status_code=204)
def delete_conversation(conversation_id: str, user: CsrfUser, db: Db) -> None:
    """Delete one tenant-owned conversation and its visible messages."""
    item = db.scalar(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.workspace_id == user.workspace.id,
        )
    )
    if not item:
        raise HTTPException(status_code=404, detail="Conversation not found")
    db.delete(item)
    record_audit(db, user, "agent.conversation_deleted", "conversation", conversation_id)


@router.get("/proposed-changes")
def proposed_changes(user: CurrentUser, db: Db) -> list[dict[str, object]]:
    """List change previews awaiting the current user's approval."""
    items = db.scalars(
        select(ProposedChange)
        .where(ProposedChange.workspace_id == user.workspace.id)
        .order_by(ProposedChange.created_at.desc())
    ).all()
    return [
        {
            "id": item.id,
            "target_type": item.target_type,
            "target_id": item.target_id,
            "operations": item.operations,
            "evidence_ids": item.evidence_ids,
            "status": item.status,
            "created_at": item.created_at,
        }
        for item in items
    ]


@router.post("/proposed-changes/{change_id}/decision")
def decide_proposed_change(
    change_id: str, payload: ProposedChangeDecision, user: CsrfUser, db: Db
) -> dict[str, str]:
    """Approve or reject an agent proposal; only this deterministic service may apply it."""
    change = db.scalar(
        select(ProposedChange).where(
            ProposedChange.id == change_id,
            ProposedChange.workspace_id == user.workspace.id,
        )
    )
    if not change:
        raise HTTPException(status_code=404, detail="Proposed change not found")
    if change.status != "pending":
        raise HTTPException(status_code=409, detail="Proposed change has already been decided")
    if payload.decision == "approved":
        if (
            change.target_type != "professional_profile"
            or change.target_id != user.workspace.profile.id
        ):
            raise HTTPException(status_code=400, detail="Unsupported change target")
        profile = db.scalar(
            select(ProfessionalProfile).where(
                ProfessionalProfile.id == change.target_id,
                ProfessionalProfile.workspace_id == user.workspace.id,
            )
        )
        if not profile:
            raise HTTPException(status_code=404, detail="Change target not found")
        allowed = {"headline", "summary", "location", "seniority", "availability", "preferences"}
        for operation in change.operations:
            field = str(operation.get("path", "")).lstrip("/")
            if field not in allowed or "/" in field:
                raise HTTPException(
                    status_code=400, detail="Change operation is outside the approved allowlist"
                )
            op = operation.get("op")
            if op in {"add", "replace"}:
                setattr(profile, field, operation.get("value"))
            elif op == "remove":
                setattr(profile, field, {} if field == "preferences" else "")
            else:
                raise HTTPException(status_code=400, detail="Unsupported change operation")
        profile.revision += 1
    change.status = payload.decision
    change.decided_at = utcnow()
    record_audit(db, user, f"agent.change_{payload.decision}", "proposed_change", change.id)
    return {"id": change.id, "status": change.status}
