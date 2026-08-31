"""Versioned evidence-grounded resume and communication artifact endpoints."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.orm import selectinload

from careertwin.api.dependencies import CsrfUser, CurrentUser, Db
from careertwin.models import (
    Accomplishment,
    CareerArtifact,
    ClaimState,
    EvidenceClaim,
    Opportunity,
    ProfessionalProfile,
    ResumeVariant,
)
from careertwin.schemas import (
    AccomplishmentCreate,
    AccomplishmentRead,
    ArtifactCreate,
    ArtifactRead,
    ResumeVariantCreate,
    ResumeVariantRead,
)
from careertwin.services.artifacts import compose_artifact, compose_resume_variant
from careertwin.services.audit import record_audit

router = APIRouter(prefix="/api/artifacts", tags=["career artifacts"])


def _confirmed_claims(
    db: Db,
    workspace_id: str,
    evidence_ids: list[str],
    *,
    all_if_empty: bool = True,
) -> list[EvidenceClaim]:
    query = select(EvidenceClaim).where(
        EvidenceClaim.workspace_id == workspace_id,
        EvidenceClaim.state == ClaimState.CONFIRMED,
    )
    if not evidence_ids and not all_if_empty:
        return []
    if evidence_ids:
        query = query.where(EvidenceClaim.id.in_(evidence_ids))
    claims = list(db.scalars(query.order_by(EvidenceClaim.created_at).limit(300)).all())
    if evidence_ids and len(claims) != len(set(evidence_ids)):
        raise HTTPException(status_code=400, detail="Every evidence item must be confirmed")
    return claims


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
    claims = _confirmed_claims(db, user.workspace.id, payload.evidence_ids, all_if_empty=False)
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


@router.get("/accomplishments", response_model=list[AccomplishmentRead])
def list_accomplishments(user: CurrentUser, db: Db) -> list[AccomplishmentRead]:
    """List the seeker's evidence-backed accomplishment bank."""
    items = db.scalars(
        select(Accomplishment)
        .where(Accomplishment.workspace_id == user.workspace.id)
        .order_by(Accomplishment.updated_at.desc())
    ).all()
    return [AccomplishmentRead.model_validate(item) for item in items]


@router.post("/accomplishments", response_model=AccomplishmentRead, status_code=201)
def create_accomplishment(
    payload: AccomplishmentCreate, user: CsrfUser, db: Db
) -> AccomplishmentRead:
    """Create a STAR record whose confirmation requires confirmed supporting evidence."""
    claims = _confirmed_claims(db, user.workspace.id, payload.evidence_ids, all_if_empty=False)
    if payload.status == "confirmed" and not claims:
        raise HTTPException(status_code=400, detail="Confirmed accomplishments require evidence")
    item = Accomplishment(workspace_id=user.workspace.id, **payload.model_dump())
    db.add(item)
    db.flush()
    record_audit(db, user, "artifact.accomplishment_created", "accomplishment", item.id)
    return AccomplishmentRead.model_validate(item)


@router.put("/accomplishments/{item_id}", response_model=AccomplishmentRead)
def update_accomplishment(
    item_id: str, payload: AccomplishmentCreate, user: CsrfUser, db: Db
) -> AccomplishmentRead:
    """Update one tenant-owned STAR record and re-check its evidence links."""
    item = db.scalar(
        select(Accomplishment).where(
            Accomplishment.id == item_id, Accomplishment.workspace_id == user.workspace.id
        )
    )
    if not item:
        raise HTTPException(status_code=404, detail="Accomplishment not found")
    claims = _confirmed_claims(db, user.workspace.id, payload.evidence_ids, all_if_empty=False)
    if payload.status == "confirmed" and not claims:
        raise HTTPException(status_code=400, detail="Confirmed accomplishments require evidence")
    for field, value in payload.model_dump().items():
        setattr(item, field, value)
    record_audit(db, user, "artifact.accomplishment_updated", "accomplishment", item.id)
    return AccomplishmentRead.model_validate(item)


@router.delete("/accomplishments/{item_id}", status_code=204)
def delete_accomplishment(item_id: str, user: CsrfUser, db: Db) -> None:
    """Delete a tenant-owned draft or archived accomplishment."""
    result = db.execute(
        delete(Accomplishment).where(
            Accomplishment.id == item_id, Accomplishment.workspace_id == user.workspace.id
        )
    )
    if not getattr(result, "rowcount", 0):
        raise HTTPException(status_code=404, detail="Accomplishment not found")
    record_audit(db, user, "artifact.accomplishment_deleted", "accomplishment", item_id)


@router.get("/resume-variants", response_model=list[ResumeVariantRead])
def list_resume_variants(user: CurrentUser, db: Db) -> list[ResumeVariantRead]:
    """List immutable resume versions, newest first."""
    items = db.scalars(
        select(ResumeVariant)
        .where(ResumeVariant.workspace_id == user.workspace.id)
        .order_by(ResumeVariant.updated_at.desc())
    ).all()
    return [ResumeVariantRead.model_validate(item) for item in items]


@router.post("/resume-variants", response_model=ResumeVariantRead, status_code=201)
def create_resume_variant(
    payload: ResumeVariantCreate, user: CsrfUser, db: Db
) -> ResumeVariantRead:
    """Create the next immutable resume version from confirmed evidence and STAR records."""
    claims = _confirmed_claims(db, user.workspace.id, payload.evidence_ids, all_if_empty=False)
    accomplishments = list(
        db.scalars(
            select(Accomplishment).where(
                Accomplishment.workspace_id == user.workspace.id,
                Accomplishment.id.in_(payload.accomplishment_ids),
                Accomplishment.status == "confirmed",
            )
        ).all()
    )
    if len(accomplishments) != len(set(payload.accomplishment_ids)):
        raise HTTPException(status_code=400, detail="Resume accomplishments must be confirmed")
    opportunity = None
    if payload.opportunity_id:
        opportunity = db.scalar(
            select(Opportunity).where(
                Opportunity.id == payload.opportunity_id,
                Opportunity.workspace_id == user.workspace.id,
            )
        )
        if not opportunity:
            raise HTTPException(status_code=404, detail="Opportunity not found")
    profile = db.scalar(
        select(ProfessionalProfile).where(ProfessionalProfile.workspace_id == user.workspace.id)
    )
    if not profile:
        raise HTTPException(status_code=500, detail="Profile is not initialized")
    previous = db.scalar(
        select(func.max(ResumeVariant.version)).where(
            ResumeVariant.workspace_id == user.workspace.id,
            ResumeVariant.name == payload.name,
        )
    )
    item = ResumeVariant(
        workspace_id=user.workspace.id,
        name=payload.name,
        version=(previous or 0) + 1,
        opportunity_id=payload.opportunity_id,
        summary=payload.summary,
        section_order=payload.section_order,
        evidence_ids=[claim.id for claim in claims],
        accomplishment_ids=[entry.id for entry in accomplishments],
        content=compose_resume_variant(
            profile, claims, accomplishments, opportunity, payload.summary
        ),
    )
    db.add(item)
    db.flush()
    record_audit(
        db,
        user,
        "artifact.resume_variant_created",
        "resume_variant",
        item.id,
        {"name": item.name, "version": item.version},
    )
    return ResumeVariantRead.model_validate(item)
