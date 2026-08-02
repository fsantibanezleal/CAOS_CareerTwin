"""ARQ worker jobs for durable ingestion, retention and reminder pipelines."""

from __future__ import annotations

import asyncio
from datetime import timedelta
from typing import Any, ClassVar, cast

from arq import cron
from arq.connections import RedisSettings
from arq.typing import WorkerCoroutine
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
    """Execute one durable bounded run without blocking the ARQ event loop."""
    return await asyncio.to_thread(execute_agent_run, workspace_id, run_id)


class WorkerSettings:
    """ARQ discovery contract used by `arq careertwin.worker.WorkerSettings`."""

    functions: ClassVar[list[Any]] = [
        process_source,
        process_agent_run,
        retention_sweep,
        due_reminder_sweep,
    ]
    cron_jobs: ClassVar[list[Any]] = [
        cron(cast(WorkerCoroutine, retention_sweep), hour=3, minute=15),
        cron(cast(WorkerCoroutine, due_reminder_sweep), minute={0, 15, 30, 45}),
    ]
    redis_settings = RedisSettings.from_dsn(get_settings().redis_url)
    max_jobs = get_settings().worker_max_jobs
    job_timeout = 600
    keep_result = 3600
