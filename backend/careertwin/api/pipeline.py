"""Application state machine, task calendar and candidate-owned funnel endpoints."""

from __future__ import annotations

from collections import Counter
from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import select

from careertwin.api.dependencies import CsrfUser, CurrentUser, Db
from careertwin.models import (
    Application,
    ApplicationStage,
    CareerTask,
    Opportunity,
    StageEvent,
    utcnow,
)
from careertwin.schemas import ApplicationCreate, ApplicationRead, StageChange, TaskCreate, TaskRead
from careertwin.services.audit import record_audit
from careertwin.services.calendar import export_calendar

router = APIRouter(prefix="/api/pipeline", tags=["application pipeline"])

TRANSITIONS: dict[str, set[str]] = {
    "saved": {"preparing", "withdrawn"},
    "preparing": {"saved", "applied", "withdrawn"},
    "applied": {"screening", "interview", "rejected", "withdrawn"},
    "screening": {"interview", "offer", "rejected", "withdrawn"},
    "interview": {"interview", "offer", "rejected", "withdrawn"},
    "offer": {"accepted", "rejected", "withdrawn"},
    "accepted": set(),
    "withdrawn": set(),
    "rejected": set(),
}


@router.get("/applications", response_model=list[ApplicationRead])
def list_applications(user: CurrentUser, db: Db) -> list[ApplicationRead]:
    """List the current seeker's application aggregates."""
    items = db.scalars(
        select(Application)
        .where(Application.workspace_id == user.workspace.id)
        .order_by(Application.updated_at.desc())
    ).all()
    return [ApplicationRead.model_validate(item) for item in items]


@router.post("/applications", response_model=ApplicationRead, status_code=status.HTTP_201_CREATED)
def create_application(payload: ApplicationCreate, user: CsrfUser, db: Db) -> ApplicationRead:
    """Start tracking a tenant-owned opportunity in the candidate pipeline."""
    opportunity = db.scalar(
        select(Opportunity).where(
            Opportunity.id == payload.opportunity_id,
            Opportunity.workspace_id == user.workspace.id,
        )
    )
    if not opportunity:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    existing = db.scalar(
        select(Application).where(
            Application.workspace_id == user.workspace.id,
            Application.opportunity_id == payload.opportunity_id,
        )
    )
    if existing:
        raise HTTPException(status_code=409, detail="Application already exists")
    item = Application(workspace_id=user.workspace.id, **payload.model_dump())
    db.add(item)
    db.flush()
    db.add(
        StageEvent(
            workspace_id=user.workspace.id,
            application_id=item.id,
            from_stage=None,
            to_stage=ApplicationStage.SAVED.value,
            note="Application tracking started",
        )
    )
    record_audit(db, user, "application.created", "application", item.id)
    return ApplicationRead.model_validate(item)


@router.post("/applications/{application_id}/stage", response_model=ApplicationRead)
def change_stage(
    application_id: str, payload: StageChange, user: CsrfUser, db: Db
) -> ApplicationRead:
    """Apply a legal stage transition and append immutable history."""
    item = db.scalar(
        select(Application).where(
            Application.id == application_id, Application.workspace_id == user.workspace.id
        )
    )
    if not item:
        raise HTTPException(status_code=404, detail="Application not found")
    before, after = item.stage.value, payload.stage
    if after not in TRANSITIONS[before]:
        raise HTTPException(
            status_code=409, detail=f"Transition {before} -> {after} is not allowed"
        )
    item.stage = ApplicationStage(after)
    if after == "applied" and item.applied_at is None:
        item.applied_at = utcnow()
    if after in {"accepted", "withdrawn", "rejected"}:
        item.closed_at = utcnow()
    db.add(
        StageEvent(
            workspace_id=user.workspace.id,
            application_id=item.id,
            from_stage=before,
            to_stage=after,
            note=payload.note,
        )
    )
    record_audit(
        db, user, "application.stage_changed", "application", item.id, {"from": before, "to": after}
    )
    return ApplicationRead.model_validate(item)


@router.get("/applications/{application_id}/history")
def application_history(application_id: str, user: CurrentUser, db: Db) -> list[dict[str, object]]:
    """Return append-only stage history for one tenant-owned application."""
    exists = db.scalar(
        select(Application.id).where(
            Application.id == application_id, Application.workspace_id == user.workspace.id
        )
    )
    if not exists:
        raise HTTPException(status_code=404, detail="Application not found")
    events = db.scalars(
        select(StageEvent)
        .where(
            StageEvent.application_id == application_id,
            StageEvent.workspace_id == user.workspace.id,
        )
        .order_by(StageEvent.occurred_at)
    ).all()
    return [
        {
            "id": item.id,
            "from_stage": item.from_stage,
            "to_stage": item.to_stage,
            "note": item.note,
            "occurred_at": item.occurred_at,
        }
        for item in events
    ]


@router.get("/tasks", response_model=list[TaskRead])
def list_tasks(user: CurrentUser, db: Db) -> list[TaskRead]:
    """List tasks, meetings and deadlines in time order."""
    items = db.scalars(
        select(CareerTask)
        .where(CareerTask.workspace_id == user.workspace.id)
        .order_by(CareerTask.completed_at.is_not(None), CareerTask.due_at)
    ).all()
    return [TaskRead.model_validate(item) for item in items]


@router.post("/tasks", response_model=TaskRead, status_code=status.HTTP_201_CREATED)
def create_task(payload: TaskCreate, user: CsrfUser, db: Db) -> TaskRead:
    """Create a career task, deadline, reminder or meeting."""
    if payload.application_id:
        exists = db.scalar(
            select(Application.id).where(
                Application.id == payload.application_id,
                Application.workspace_id == user.workspace.id,
            )
        )
        if not exists:
            raise HTTPException(
                status_code=400, detail="Application does not belong to this workspace"
            )
    item = CareerTask(workspace_id=user.workspace.id, **payload.model_dump())
    db.add(item)
    db.flush()
    record_audit(db, user, "task.created", "career_task", item.id, {"kind": item.kind})
    return TaskRead.model_validate(item)


@router.post("/tasks/{task_id}/complete", response_model=TaskRead)
def complete_task(task_id: str, user: CsrfUser, db: Db) -> TaskRead:
    """Mark a tenant-owned task complete."""
    item = db.scalar(
        select(CareerTask).where(
            CareerTask.id == task_id, CareerTask.workspace_id == user.workspace.id
        )
    )
    if not item:
        raise HTTPException(status_code=404, detail="Task not found")
    item.completed_at = utcnow()
    record_audit(db, user, "task.completed", "career_task", item.id)
    return TaskRead.model_validate(item)


@router.get("/calendar.ics")
def calendar_ics(user: CurrentUser, db: Db) -> Response:
    """Export RFC 5545 calendar data for user-controlled import into calendar tools."""
    tasks = list(
        db.scalars(select(CareerTask).where(CareerTask.workspace_id == user.workspace.id)).all()
    )
    return Response(
        export_calendar(tasks),
        media_type="text/calendar; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="careertwin-calendar.ics"'},
    )


@router.get("/analytics")
def pipeline_analytics(user: CurrentUser, db: Db) -> dict[str, object]:
    """Return denominator-aware candidate funnel measures with small-sample warnings."""
    items = list(
        db.scalars(select(Application).where(Application.workspace_id == user.workspace.id)).all()
    )
    stages = Counter(item.stage.value for item in items)
    applied = [item for item in items if item.applied_at]
    closed = [item for item in items if item.closed_at and item.applied_at]
    durations = [
        (item.closed_at - item.applied_at).total_seconds() / 86400
        for item in closed
        if item.closed_at and item.applied_at
    ]
    return {
        "denominator": len(items),
        "by_stage": dict(stages),
        "applied_count": len(applied),
        "median_days_to_close": sorted(durations)[len(durations) // 2] if durations else None,
        "sample_warning": len(items) < 10,
        "meaning": "Personal process history only; it is not an employer or labor-market benchmark.",
        "generated_at": datetime.now(UTC),
    }
