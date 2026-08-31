"""Dashboard, portable export and self-service account data endpoints."""

from __future__ import annotations

import io
import json
import zipfile
from collections import Counter
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Response
from sqlalchemy import func, select

from careertwin.api.dependencies import CsrfUser, CurrentUser, Db
from careertwin.models import (
    AgentMessage,
    AgentRun,
    Application,
    AuditEvent,
    CareerArtifact,
    CareerTask,
    ClaimState,
    Contact,
    Conversation,
    Education,
    EvidenceClaim,
    Experience,
    MatchRun,
    Opportunity,
    OpportunitySnapshot,
    ProfessionalProfile,
    ProposedChange,
    Recommendation,
    Requirement,
    Skill,
    Source,
    StageEvent,
    TargetSet,
)
from careertwin.schemas import DashboardSummary, TaskRead
from careertwin.services.audit import record_audit

router = APIRouter(prefix="/api/workspace", tags=["workspace"])


@router.get("/today", response_model=DashboardSummary)
def today(user: CurrentUser, db: Db) -> DashboardSummary:
    """Summarize readiness, pending review, opportunities, pipeline and upcoming work."""
    workspace_id = user.workspace.id
    profile = db.scalar(
        select(ProfessionalProfile).where(ProfessionalProfile.workspace_id == workspace_id)
    )
    fields = (
        [
            profile.headline,
            profile.summary,
            profile.location,
            profile.seniority,
            profile.availability,
        ]
        if profile
        else []
    )
    completeness = sum(bool(value.strip()) for value in fields) / len(fields) if fields else 0
    confirmed = (
        db.scalar(
            select(func.count(EvidenceClaim.id)).where(
                EvidenceClaim.workspace_id == workspace_id,
                EvidenceClaim.state == ClaimState.CONFIRMED,
            )
        )
        or 0
    )
    pending = (
        db.scalar(
            select(func.count(EvidenceClaim.id)).where(
                EvidenceClaim.workspace_id == workspace_id,
                EvidenceClaim.state == ClaimState.PROPOSED,
            )
        )
        or 0
    )
    opportunities = (
        db.scalar(
            select(func.count(Opportunity.id)).where(
                Opportunity.workspace_id == workspace_id,
                Opportunity.status.in_(["watching", "active"]),
            )
        )
        or 0
    )
    applications = list(
        db.scalars(select(Application).where(Application.workspace_id == workspace_id)).all()
    )
    tasks = list(
        db.scalars(
            select(CareerTask)
            .where(CareerTask.workspace_id == workspace_id, CareerTask.completed_at.is_(None))
            .order_by(CareerTask.due_at)
            .limit(8)
        ).all()
    )
    runs = list(
        db.scalars(
            select(MatchRun)
            .where(MatchRun.workspace_id == workspace_id)
            .order_by(MatchRun.created_at.desc())
        ).all()
    )
    latest: dict[str, MatchRun] = {}
    for run in runs:
        latest.setdefault(run.opportunity_id, run)
    known = [run for run in latest.values() if run.score is not None]
    coverage_sum = sum(run.coverage for run in known)
    global_score = (
        sum((run.score or 0) * run.coverage for run in known) / coverage_sum
        if coverage_sum
        else None
    )
    return DashboardSummary(
        profile_completeness=round(completeness, 4),
        confirmed_evidence=confirmed,
        review_pending=pending,
        active_opportunities=opportunities,
        applications_by_stage=dict(Counter(item.stage.value for item in applications)),
        upcoming_tasks=[TaskRead.model_validate(item) for item in tasks],
        global_alignment=round(global_score, 4) if global_score is not None else None,
        global_alignment_coverage=(
            round(sum(run.coverage for run in latest.values()) / len(latest), 4) if latest else 0
        ),
    )


@router.get("/export")
def export_workspace(user: CsrfUser, db: Db) -> Response:
    """Export all current user-controlled canonical data as a portable JSON ZIP."""
    workspace_id = user.workspace.id
    model_types: list[Any] = [
        ProfessionalProfile,
        Source,
        Skill,
        Experience,
        Education,
        EvidenceClaim,
        Opportunity,
        OpportunitySnapshot,
        TargetSet,
        Requirement,
        MatchRun,
        Recommendation,
        CareerArtifact,
        Application,
        StageEvent,
        CareerTask,
        Contact,
        Conversation,
        AgentMessage,
        AgentRun,
        ProposedChange,
        AuditEvent,
    ]
    payload: dict[str, object] = {
        "format": "CareerTwin export",
        "schema_version": "1.0",
        "exported_at": datetime.now(UTC).isoformat(),
        "account": {"email": user.email, "display_name": user.display_name, "locale": user.locale},
    }
    for model in model_types:
        rows = db.scalars(select(model).where(model.workspace_id == workspace_id)).all()
        payload[model.__tablename__] = [
            {
                column.name: (
                    value.isoformat()
                    if isinstance(value, datetime)
                    else value.value
                    if hasattr(value, "value")
                    else value
                )
                for column in model.__table__.columns
                if column.name not in {"workspace_id", "storage_key", "extracted_text"}
                for value in [getattr(row, column.name)]
            }
            for row in rows
        ]
    raw = json.dumps(payload, ensure_ascii=False, indent=2).encode()
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("careertwin-export.json", raw)
    record_audit(db, user, "workspace.exported", "workspace", workspace_id)
    return Response(
        buffer.getvalue(),
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="careertwin-export.zip"'},
    )
