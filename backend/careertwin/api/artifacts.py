"""Versioned evidence-grounded resume and communication artifact endpoints."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from careertwin.api.dependencies import CsrfUser, CurrentUser, Db
from careertwin.models import (
    CareerArtifact,
    ClaimState,
    EvidenceClaim,
    Opportunity,
    ProfessionalProfile,
)
from careertwin.schemas import ArtifactCreate, ArtifactRead
from careertwin.services.artifacts import compose_artifact
from careertwin.services.audit import record_audit

router = APIRouter(prefix="/api/artifacts", tags=["career artifacts"])


@router.get("", response_model=list[ArtifactRead])
def list_artifacts(user: CurrentUser, db: Db) -> list[ArtifactRead]:
    """List tenant-owned draft versions, newest first."""
    items = db.scalars(
        select(CareerArtifact)
        .where(CareerArtifact.workspace_id == user.workspace.id)
        .order_by(CareerArtifact.updated_at.desc())
    ).all()
    return [ArtifactRead.model_validate(item) for item in items]


@router.post("", response_model=ArtifactRead, status_code=status.HTTP_201_CREATED)
def create_artifact(payload: ArtifactCreate, user: CsrfUser, db: Db) -> ArtifactRead:
    """Compose a new immutable draft version from selected confirmed evidence."""
    opportunity = None
    if payload.opportunity_id:
        opportunity = db.scalar(
            select(Opportunity)
            .options(selectinload(Opportunity.requirements))
            .where(
                Opportunity.id == payload.opportunity_id,
                Opportunity.workspace_id == user.workspace.id,
            )
        )
        if not opportunity:
            raise HTTPException(status_code=404, detail="Opportunity not found")
    query = select(EvidenceClaim).where(
        EvidenceClaim.workspace_id == user.workspace.id,
        EvidenceClaim.state == ClaimState.CONFIRMED,
    )
    if payload.evidence_ids:
        query = query.where(EvidenceClaim.id.in_(payload.evidence_ids))
    claims = list(db.scalars(query.order_by(EvidenceClaim.created_at).limit(200)).all())
    if payload.evidence_ids and len(claims) != len(set(payload.evidence_ids)):
        raise HTTPException(
            status_code=400, detail="Every selected evidence item must be confirmed"
        )
    profile = db.scalar(
        select(ProfessionalProfile).where(ProfessionalProfile.workspace_id == user.workspace.id)
    )
    if not profile:
        raise HTTPException(status_code=500, detail="Profile is not initialized")
    previous = db.scalar(
        select(func.max(CareerArtifact.version)).where(
            CareerArtifact.workspace_id == user.workspace.id,
            CareerArtifact.kind == payload.kind,
            CareerArtifact.title == payload.title,
        )
    )
    item = CareerArtifact(
        workspace_id=user.workspace.id,
        opportunity_id=payload.opportunity_id,
        kind=payload.kind,
        title=payload.title,
        version=(previous or 0) + 1,
        content=compose_artifact(payload.kind, profile, claims, opportunity),
        evidence_ids=[claim.id for claim in claims],
    )
    db.add(item)
    db.flush()
    record_audit(
        db,
        user,
        "artifact.created",
        "career_artifact",
        item.id,
        {"kind": item.kind, "version": item.version},
    )
    return ArtifactRead.model_validate(item)
