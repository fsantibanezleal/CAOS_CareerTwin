"""Persistent evidence-cited chat and proposed-change approval endpoints."""

from __future__ import annotations

import hashlib
import json

from arq import create_pool
from arq.connections import RedisSettings
from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from careertwin.agent.contracts import AgentContext, AgentDraft
from careertwin.agent.prompts import registry_manifest
from careertwin.agent.providers import provider_registry
from careertwin.agent.workflow import run_workflow
from careertwin.api.dependencies import Config, CsrfUser, CurrentUser, Db
from careertwin.models import (
    AgentMessage,
    AgentRun,
    AgentTrace,
    ClaimState,
    Conversation,
    EvidenceClaim,
    MatchRun,
    ProfessionalProfile,
    ProposedChange,
    utcnow,
)
from careertwin.schemas import AgentRunRead, ChatRequest, ChatResponse, ProposedChangeDecision
from careertwin.services.audit import record_audit
from careertwin.services.model_extraction import OpportunityExtraction, ProfileExtraction

router = APIRouter(prefix="/api/agent", tags=["agentic concierge"])


async def _enqueue(settings: Config, workspace_id: str, run_id: str) -> None:
    """Submit a durable run to ARQ and close the short-lived producer connection."""
    pool = await create_pool(RedisSettings.from_dsn(settings.redis_url))
    try:
        job = await pool.enqueue_job("process_agent_run", workspace_id, run_id, _job_id=run_id)
        if job is None:
            raise RuntimeError("Agent run is already queued")
    finally:
        await pool.aclose()


@router.get("/providers")
def available_providers(_: CurrentUser, settings: Config) -> dict[str, object]:
    """List configured provider names without exposing keys or provider configuration payloads."""
    providers = provider_registry(settings)
    names = sorted(providers)
    return {
        "providers": names,
        "default": settings.llm_default_provider,
        "local_private_provider": "ollama" in providers,
    }


@router.get("/contracts")
def agent_contracts(_: CurrentUser) -> list[dict[str, str]]:
    """Expose version/digest provenance without returning operational prompt text."""
    return registry_manifest(
        {
            "career-agent": AgentDraft.model_json_schema(),
            "profile-evidence-extraction": ProfileExtraction.model_json_schema(),
            "opportunity-requirement-extraction": OpportunityExtraction.model_json_schema(),
        }
    )


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
    user_message = AgentMessage(
        workspace_id=user.workspace.id,
        conversation_id=conversation.id,
        role="user",
        content=payload.message,
    )
    db.add(user_message)
    db.flush()
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
        state={
            "phase": "provider",
            "evidence_count": len(evidence),
            "message_id": user_message.id,
            "opportunity_id": payload.opportunity_id,
        },
        started_at=utcnow(),
    )
    db.add(agent_run)
    db.flush()
    try:
        draft = run_workflow(provider, context)
    except Exception as exc:
        agent_run.status = "failed"
        agent_run.error_code = type(exc).__name__
        agent_run.state = {**agent_run.state, "phase": "failed"}
        agent_run.finished_at = utcnow()
        db.commit()
        raise HTTPException(
            status_code=502, detail=f"Agent run failed safely: {type(exc).__name__}"
        ) from exc
    agent_run.status = "completed"
    agent_run.specialist = draft.specialist
    agent_run.state = {**agent_run.state, "phase": "completed", "citations": len(draft.citations)}
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
    agent_run.state = {
        **agent_run.state,
        "phase": "completed",
        "citations": len(draft.citations),
        "assistant_message_id": assistant.id,
        "proposed_change_id": proposed.id if proposed else None,
    }
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
        run_id=agent_run.id,
    )


@router.post("/runs", response_model=AgentRunRead, status_code=201)
async def queue_run(payload: ChatRequest, user: CsrfUser, db: Db, settings: Config) -> AgentRunRead:
    """Queue a durable agent turn that can be polled, cancelled and retried."""
    providers = provider_registry(settings)
    provider_name = payload.provider or settings.llm_default_provider
    if provider_name not in providers:
        raise HTTPException(status_code=400, detail="Requested provider is not configured")
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
    message = AgentMessage(
        workspace_id=user.workspace.id,
        conversation_id=conversation.id,
        role="user",
        content=payload.message,
    )
    db.add(message)
    db.flush()
    digest = hashlib.sha256(
        json.dumps(
            {
                "message_id": message.id,
                "opportunity_id": payload.opportunity_id,
                "provider": provider_name,
            },
            sort_keys=True,
        ).encode()
    ).hexdigest()
    run = AgentRun(
        workspace_id=user.workspace.id,
        conversation_id=conversation.id,
        status="queued",
        provider=provider_name,
        input_digest=digest,
        state={
            "phase": "queued",
            "message_id": message.id,
            "opportunity_id": payload.opportunity_id,
        },
    )
    db.add(run)
    db.flush()
    record_audit(db, user, "agent.run_queued", "agent_run", run.id)
    db.commit()
    try:
        await _enqueue(settings, user.workspace.id, run.id)
    except Exception as exc:
        run.status = "failed"
        run.error_code = type(exc).__name__
        run.finished_at = utcnow()
        db.commit()
        raise HTTPException(status_code=503, detail="Agent queue is unavailable") from exc
    db.refresh(run)
    return AgentRunRead.model_validate(run)


@router.get("/runs", response_model=list[AgentRunRead])
def list_runs(user: CurrentUser, db: Db) -> list[AgentRunRead]:
    """List durable agent runs without prompts, evidence bodies or hidden reasoning."""
    runs = db.scalars(
        select(AgentRun)
        .where(AgentRun.workspace_id == user.workspace.id)
        .order_by(AgentRun.created_at.desc())
        .limit(200)
    ).all()
    return [AgentRunRead.model_validate(run) for run in runs]


@router.get("/runs/{run_id}", response_model=AgentRunRead)
def get_run(run_id: str, user: CurrentUser, db: Db) -> AgentRunRead:
    """Read one tenant-owned durable checkpoint."""
    run = db.scalar(
        select(AgentRun).where(AgentRun.id == run_id, AgentRun.workspace_id == user.workspace.id)
    )
    if not run:
        raise HTTPException(status_code=404, detail="Agent run not found")
    return AgentRunRead.model_validate(run)


@router.get("/runs/{run_id}/trace")
def get_run_trace(run_id: str, user: CurrentUser, db: Db) -> dict[str, object]:
    """Return the tenant-owned redacted trace contract, never prompts or model output."""
    trace = db.scalar(
        select(AgentTrace).where(
            AgentTrace.run_id == run_id,
            AgentTrace.workspace_id == user.workspace.id,
        )
    )
    if not trace:
        raise HTTPException(status_code=404, detail="Run trace not found")
    return {
        "trace_id": trace.trace_id,
        "provider": trace.provider,
        "specialist": trace.specialist,
        "status": trace.status,
        "input_digest": trace.input_digest,
        "evidence_count": trace.evidence_count,
        "citation_count": trace.citation_count,
        "attempt": trace.attempt,
        "external_exported": trace.external_exported,
        "created_at": trace.created_at,
    }


@router.post("/runs/{run_id}/cancel", response_model=AgentRunRead)
def cancel_run(run_id: str, user: CsrfUser, db: Db) -> AgentRunRead:
    """Cancel a queued run or request cancellation at the next durable boundary."""
    run = db.scalar(
        select(AgentRun)
        .where(AgentRun.id == run_id, AgentRun.workspace_id == user.workspace.id)
        .with_for_update()
    )
    if not run:
        raise HTTPException(status_code=404, detail="Agent run not found")
    if run.status in {"completed", "failed", "cancelled"}:
        raise HTTPException(status_code=409, detail="Agent run is already terminal")
    run.cancel_requested_at = utcnow()
    if run.status in {"queued", "retrying"}:
        run.status = "cancelled"
        run.finished_at = utcnow()
        run.state = {**run.state, "phase": "cancelled"}
    record_audit(db, user, "agent.run_cancel_requested", "agent_run", run.id)
    return AgentRunRead.model_validate(run)


@router.post("/runs/{run_id}/retry", response_model=AgentRunRead, status_code=201)
async def retry_run(run_id: str, user: CsrfUser, db: Db, settings: Config) -> AgentRunRead:
    """Create a new attempt from a failed or cancelled checkpoint and preserve the prior run."""
    previous = db.scalar(
        select(AgentRun)
        .where(AgentRun.id == run_id, AgentRun.workspace_id == user.workspace.id)
        .with_for_update()
    )
    if not previous:
        raise HTTPException(status_code=404, detail="Agent run not found")
    if previous.status not in {"failed", "cancelled"}:
        raise HTTPException(status_code=409, detail="Only failed or cancelled runs can be retried")
    if previous.provider not in provider_registry(settings):
        raise HTTPException(status_code=409, detail="The prior provider is no longer configured")
    retry = AgentRun(
        workspace_id=user.workspace.id,
        conversation_id=previous.conversation_id,
        status="retrying",
        provider=previous.provider,
        input_digest=previous.input_digest,
        state={
            **previous.state,
            "phase": "retrying",
            "assistant_message_id": None,
            "proposed_change_id": None,
        },
        parent_run_id=previous.id,
        attempt=previous.attempt + 1,
    )
    db.add(retry)
    db.flush()
    record_audit(db, user, "agent.run_retried", "agent_run", retry.id)
    db.commit()
    try:
        await _enqueue(settings, user.workspace.id, retry.id)
    except Exception as exc:
        retry.status = "failed"
        retry.error_code = type(exc).__name__
        retry.finished_at = utcnow()
        db.commit()
        raise HTTPException(status_code=503, detail="Agent queue is unavailable") from exc
    db.refresh(retry)
    return AgentRunRead.model_validate(retry)


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
