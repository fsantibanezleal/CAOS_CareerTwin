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
from careertwin.models import AuthSession, CareerTask, EvidenceClaim, Source, SourceStatus, utcnow
from careertwin.services.agent_runs import execute_agent_run
from careertwin.services.blob import FileBlobStore
from careertwin.services.ingestion import extract_text, propose_profile_claims


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
            content = FileBlobStore(settings.blob_root).read(workspace_id, source.storage_key)
            source.extracted_text = extract_text(content, source.media_type)
            proposals = propose_profile_claims(source.extracted_text, source.id)
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
    """Remove expired authentication sessions; content retention remains explicit per workspace."""
    with SessionLocal.begin() as db:
        result = db.execute(delete(AuthSession).where(AuthSession.expires_at < utcnow()))
        removed = int(getattr(result, "rowcount", 0) or 0)
        return {"expired_sessions_removed": removed}


async def due_reminder_sweep(_: dict[Any, Any], *args: Any, **kwargs: Any) -> dict[str, int]:
    """Count due reminders for the notification seam without contacting users automatically."""
    now = utcnow()
    horizon = now + timedelta(minutes=15)
    with SessionLocal() as db:
        tasks = db.scalars(
            select(CareerTask).where(
                CareerTask.completed_at.is_(None),
                CareerTask.due_at.is_not(None),
                CareerTask.due_at <= horizon,
            )
        ).all()
        return {"due": len(tasks)}


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
    max_jobs = 10
    job_timeout = 600
    keep_result = 3600
