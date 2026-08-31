"""Database-backed worker for durable ingestion, agents, retention and reminders."""

from __future__ import annotations

import asyncio
import signal
import time
from datetime import timedelta
from typing import Any

from sqlalchemy import delete, select, text
from sqlalchemy.orm import Session

from careertwin.config import get_settings
from careertwin.database import SessionLocal
from careertwin.models import (
    AuthSession,
    CareerTask,
    ClaimState,
    EmailThread,
    EvidenceClaim,
    Opportunity,
    OpportunitySnapshot,
    Requirement,
    Source,
    SourceStatus,
    Workspace,
    utcnow,
)
from careertwin.services.agent_runs import execute_agent_run
from careertwin.services.blob import configured_blob_store
from careertwin.services.ingestion import extract_document
from careertwin.services.model_extraction import (
    extract_opportunity_requirements,
    extract_profile_claims,
)
from careertwin.services.normalization import normalize_label


def _tenant(db: Session, workspace_id: str) -> None:
    """Apply the same PostgreSQL tenant context used by request transactions."""
    if db.bind is not None and db.bind.dialect.name == "postgresql":
        db.execute(
            text("SELECT set_config('app.workspace_id', :workspace_id, true)"),
            {"workspace_id": workspace_id},
        )


async def process_source(_: dict[Any, Any], workspace_id: str, source_id: str) -> dict[str, object]:
    """Resume extraction for one already scanned tenant-private source."""
    settings = get_settings()
    with SessionLocal.begin() as db:
        _tenant(db, workspace_id)
        source = db.scalar(
            select(Source).where(Source.id == source_id, Source.workspace_id == workspace_id)
        )
        if not source or not source.storage_key or not source.media_type:
            return {"status": "not-found"}
        try:
            content = configured_blob_store(settings).read(workspace_id, source.storage_key)
            extraction = extract_document(
                content,
                source.media_type,
                str(source.source_metadata.get("original_name") or "document"),
                settings,
            )
            source.extracted_text = extraction.text
            source.source_metadata = {
                **source.source_metadata,
                "extraction": {
                    "engine": extraction.engine,
                    "confidence": extraction.confidence,
                    "spans": extraction.spans,
                    "timings": extraction.timings,
                    "warnings": extraction.warnings,
                },
            }
            proposals: list[dict[str, object]]
            if source.kind == "opportunity_document":
                opportunity_id = str(source.source_metadata.get("opportunity_id") or "")
                opportunity = db.scalar(
                    select(Opportunity).where(
                        Opportunity.id == opportunity_id,
                        Opportunity.workspace_id == workspace_id,
                    )
                )
                if not opportunity:
                    raise LookupError("OpportunityNotFound")
                db.execute(
                    delete(Requirement).where(
                        Requirement.workspace_id == workspace_id,
                        Requirement.opportunity_id == opportunity.id,
                    )
                )
                proposals = extract_opportunity_requirements(extraction.text, settings)
                for proposal in proposals:
                    label = str(proposal["label"])
                    weight_value = proposal.get("weight", 1)
                    weight = (
                        float(weight_value) if isinstance(weight_value, (int, float, str)) else 1.0
                    )
                    locator_value = proposal.get("source_locator")
                    source_locator = locator_value if isinstance(locator_value, dict) else {}
                    db.add(
                        Requirement(
                            workspace_id=workspace_id,
                            opportunity_id=opportunity.id,
                            category=str(proposal.get("category", "skill")),
                            label=label,
                            normalized_name=str(
                                proposal.get("normalized_name") or normalize_label(label)
                            ),
                            taxonomy_uri=proposal.get("taxonomy_uri"),
                            importance=str(proposal.get("importance", "required")),
                            weight=weight,
                            minimum_level=proposal.get("minimum_level"),
                            source_locator=source_locator,
                        )
                    )
                opportunity.description = extraction.text
                opportunity.version += 1
                opportunity.structured_data = {
                    **opportunity.structured_data,
                    "capture_status": "ready",
                    "extraction_engine": extraction.engine,
                }
                db.flush()
                db.add(
                    OpportunitySnapshot(
                        workspace_id=workspace_id,
                        opportunity_id=opportunity.id,
                        version=opportunity.version,
                        snapshot={
                            "id": opportunity.id,
                            "title": opportunity.title,
                            "employer": opportunity.employer,
                            "description": opportunity.description,
                            "requirements": proposals,
                            "structured_data": opportunity.structured_data,
                        },
                        source_sha256=source.sha256,
                    )
                )
            else:
                db.execute(
                    delete(EvidenceClaim).where(
                        EvidenceClaim.workspace_id == workspace_id,
                        EvidenceClaim.source_id == source.id,
                        EvidenceClaim.state == ClaimState.PROPOSED,
                    )
                )
                proposals = extract_profile_claims(source.extracted_text, source.id, settings)
                for proposal in proposals:
                    db.add(EvidenceClaim(workspace_id=workspace_id, **proposal))
            source.status = SourceStatus.READY
            source.error = None
            return {"status": "ready", "proposals": len(proposals)}
        except Exception as exc:
            source.status = SourceStatus.FAILED
            source.error = type(exc).__name__
            return {"status": "failed", "error_code": type(exc).__name__}


async def retention_sweep(_: dict[Any, Any], *args: Any, **kwargs: Any) -> dict[str, int]:
    """Remove expired sessions and consent-imported email beyond its retention date."""
    with SessionLocal.begin() as db:
        result = db.execute(delete(AuthSession).where(AuthSession.expires_at < utcnow()))
        removed = int(getattr(result, "rowcount", 0) or 0)
        workspace_ids = list(db.scalars(select(Workspace.id)).all())
    expired_threads = 0
    for workspace_id in workspace_ids:
        with SessionLocal.begin() as db:
            _tenant(db, workspace_id)
            result = db.execute(
                delete(EmailThread).where(
                    EmailThread.workspace_id == workspace_id,
                    EmailThread.retention_until.is_not(None),
                    EmailThread.retention_until < utcnow(),
                )
            )
            expired_threads += int(getattr(result, "rowcount", 0) or 0)
    return {"expired_sessions_removed": removed, "expired_email_threads_removed": expired_threads}


async def due_reminder_sweep(_: dict[Any, Any], *args: Any, **kwargs: Any) -> dict[str, int]:
    """Count due reminders for the notification seam without contacting users automatically."""
    now = utcnow()
    horizon = now + timedelta(minutes=15)
    with SessionLocal() as db:
        workspace_ids = list(db.scalars(select(Workspace.id)).all())
    due = 0
    for workspace_id in workspace_ids:
        with SessionLocal() as db:
            _tenant(db, workspace_id)
            due += len(
                db.scalars(
                    select(CareerTask).where(
                        CareerTask.workspace_id == workspace_id,
                        CareerTask.completed_at.is_(None),
                        CareerTask.due_at.is_not(None),
                        CareerTask.due_at <= horizon,
                    )
                ).all()
            )
    return {"due": due}


async def process_agent_run(_: dict[Any, Any], workspace_id: str, run_id: str) -> dict[str, object]:
    """Execute one durable bounded run without blocking the worker event loop."""
    return await asyncio.to_thread(execute_agent_run, workspace_id, run_id)


def _claim_sources(limit: int) -> list[tuple[str, str]]:
    """Atomically claim pending source rows; PostgreSQL workers use SKIP LOCKED."""
    with SessionLocal.begin() as db:
        statement = (
            select(Source)
            .where(Source.status == SourceStatus.PENDING)
            .order_by(Source.created_at)
            .limit(limit)
            .with_for_update(skip_locked=True)
        )
        sources = list(db.scalars(statement).all())
        for source in sources:
            source.status = SourceStatus.PROCESSING
        return [(source.workspace_id, source.id) for source in sources]


def _claim_agent_runs(limit: int) -> list[tuple[str, str]]:
    """Atomically claim durable agent rows without an external broker."""
    from careertwin.models import AgentRun

    with SessionLocal.begin() as db:
        statement = (
            select(AgentRun)
            .where(AgentRun.status.in_({"queued", "retrying"}))
            .order_by(AgentRun.created_at)
            .limit(limit)
            .with_for_update(skip_locked=True)
        )
        runs = list(db.scalars(statement).all())
        for run in runs:
            run.status = "claimed"
            run.state = {**run.state, "phase": "claimed"}
        return [(run.workspace_id, run.id) for run in runs]


def recover_interrupted_work() -> dict[str, int]:
    """Recover stale claims after an unclean worker stop without duplicating provider calls."""
    from careertwin.models import AgentRun

    cutoff = utcnow() - timedelta(minutes=10)
    recovered_sources = 0
    recovered_runs = 0
    failed_runs = 0
    with SessionLocal.begin() as db:
        sources = list(
            db.scalars(
                select(Source).where(
                    Source.status == SourceStatus.PROCESSING,
                    Source.updated_at < cutoff,
                )
            ).all()
        )
        for source in sources:
            source.status = SourceStatus.PENDING
            recovered_sources += 1
        runs = list(
            db.scalars(
                select(AgentRun).where(
                    AgentRun.status.in_({"claimed", "running"}),
                    AgentRun.updated_at < cutoff,
                )
            ).all()
        )
        for run in runs:
            if run.status == "claimed":
                run.status = "retrying" if run.parent_run_id else "queued"
                run.state = {**run.state, "phase": run.status}
                recovered_runs += 1
            else:
                run.status = "failed"
                run.error_code = "WorkerInterrupted"
                run.finished_at = utcnow()
                run.state = {**run.state, "phase": "failed"}
                failed_runs += 1
    return {
        "sources_requeued": recovered_sources,
        "runs_requeued": recovered_runs,
        "running_runs_failed_safely": failed_runs,
    }


async def run_worker() -> None:
    """Poll canonical work state until SIGINT/SIGTERM, including scheduled maintenance."""
    settings = get_settings()
    stopping = asyncio.Event()
    loop = asyncio.get_running_loop()
    for event in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(event, stopping.set)
        except (NotImplementedError, RuntimeError):
            signal.signal(event, lambda *_: loop.call_soon_threadsafe(stopping.set))
    recover_interrupted_work()
    next_retention = time.monotonic()
    next_reminders = time.monotonic()
    while not stopping.is_set():
        worked = False
        for workspace_id, source_id in _claim_sources(settings.worker_batch_size):
            worked = True
            await process_source({}, workspace_id, source_id)
        for workspace_id, run_id in _claim_agent_runs(settings.worker_batch_size):
            worked = True
            await process_agent_run({}, workspace_id, run_id)
        now = time.monotonic()
        if now >= next_retention:
            await retention_sweep({})
            next_retention = now + 24 * 60 * 60
        if now >= next_reminders:
            await due_reminder_sweep({})
            next_reminders = now + 15 * 60
        if not worked:
            try:
                await asyncio.wait_for(stopping.wait(), timeout=settings.worker_poll_seconds)
            except TimeoutError:
                pass


def main() -> None:
    """Run the complete native background system without Redis or a queue service."""
    asyncio.run(run_worker())


if __name__ == "__main__":
    main()
