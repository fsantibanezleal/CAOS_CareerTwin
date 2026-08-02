"""Opportunity capture, normalization, versioning and visualization endpoints."""

from __future__ import annotations

import hashlib
from collections import Counter

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from sqlalchemy import delete, select
from sqlalchemy.orm import selectinload

from careertwin.api.dependencies import Config, CsrfUser, CurrentUser, Db
from careertwin.models import Opportunity, Requirement, Source, SourceStatus
from careertwin.schemas import (
    OpportunityCreate,
    OpportunityRead,
    OpportunityUrlCapture,
    RequirementInput,
)
from careertwin.services.audit import record_audit
from careertwin.services.blob import FileBlobStore
from careertwin.services.ingestion import clamav_scan, extract_text, inspect_content
from careertwin.services.normalization import normalize_label
from careertwin.services.opportunity_ingestion import (
    UnsafeUrlError,
    capture_url,
    propose_requirements,
)

router = APIRouter(prefix="/api/opportunities", tags=["opportunities"])


def _requirement(workspace_id: str, opportunity_id: str, item: RequirementInput) -> Requirement:
    return Requirement(
        workspace_id=workspace_id,
        opportunity_id=opportunity_id,
        normalized_name=item.normalized_name or normalize_label(item.label),
        **item.model_dump(exclude={"normalized_name"}),
    )


def _find(db: Db, workspace_id: str, opportunity_id: str) -> Opportunity:
    item = db.scalar(
        select(Opportunity)
        .options(selectinload(Opportunity.requirements))
        .where(Opportunity.id == opportunity_id, Opportunity.workspace_id == workspace_id)
    )
    if not item:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    return item


@router.get("", response_model=list[OpportunityRead])
def list_opportunities(user: CurrentUser, db: Db) -> list[OpportunityRead]:
    """List the current seeker's opportunities, newest activity first."""
    items = db.scalars(
        select(Opportunity)
        .options(selectinload(Opportunity.requirements))
        .where(Opportunity.workspace_id == user.workspace.id)
        .order_by(Opportunity.updated_at.desc())
    ).all()
    return [OpportunityRead.model_validate(item) for item in items]


@router.get("/{opportunity_id}", response_model=OpportunityRead)
def get_opportunity(opportunity_id: str, user: CurrentUser, db: Db) -> OpportunityRead:
    """Read one tenant-owned opportunity and its atomic requirements."""
    return OpportunityRead.model_validate(_find(db, user.workspace.id, opportunity_id))


@router.post("", response_model=OpportunityRead, status_code=status.HTTP_201_CREATED)
def create_opportunity(payload: OpportunityCreate, user: CsrfUser, db: Db) -> OpportunityRead:
    """Create a manually reviewed opportunity; no extraction field is silently canonicalized."""
    data = payload.model_dump(exclude={"requirements", "source_url"})
    source_url = str(payload.source_url) if payload.source_url else None
    digest = (
        hashlib.sha256(payload.description.encode()).hexdigest() if payload.description else None
    )
    item = Opportunity(
        workspace_id=user.workspace.id,
        source_url=source_url,
        source_sha256=digest,
        **data,
    )
    db.add(item)
    db.flush()
    item.requirements = [
        _requirement(user.workspace.id, item.id, value) for value in payload.requirements
    ]
    record_audit(
        db, user, "opportunity.created", "opportunity", item.id, {"source_kind": item.source_kind}
    )
    db.flush()
    return OpportunityRead.model_validate(item)


@router.put("/{opportunity_id}", response_model=OpportunityRead)
def update_opportunity(
    opportunity_id: str, payload: OpportunityCreate, user: CsrfUser, db: Db
) -> OpportunityRead:
    """Replace reviewed opportunity fields and requirements while incrementing its version."""
    item = _find(db, user.workspace.id, opportunity_id)
    data = payload.model_dump(exclude={"requirements", "source_url"})
    for field, value in data.items():
        setattr(item, field, value)
    item.source_url = str(payload.source_url) if payload.source_url else None
    item.source_sha256 = (
        hashlib.sha256(payload.description.encode()).hexdigest() if payload.description else None
    )
    item.version += 1
    item.requirements.clear()
    db.flush()
    item.requirements = [
        _requirement(user.workspace.id, item.id, value) for value in payload.requirements
    ]
    record_audit(db, user, "opportunity.updated", "opportunity", item.id, {"version": item.version})
    db.flush()
    return OpportunityRead.model_validate(item)


@router.post("/capture-url", response_model=OpportunityRead, status_code=status.HTTP_201_CREATED)
def capture_opportunity_url(
    payload: OpportunityUrlCapture, user: CsrfUser, db: Db, settings: Config
) -> OpportunityRead:
    """Capture one hardened public page and persist extracted values as reviewable opportunity data."""
    try:
        captured = capture_url(str(payload.url), settings.max_url_bytes)
    except UnsafeUrlError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Opportunity capture failed: {exc}") from exc
    duplicate = db.scalar(
        select(Opportunity).where(
            Opportunity.workspace_id == user.workspace.id,
            Opportunity.source_sha256 == captured.sha256,
        )
    )
    if duplicate:
        raise HTTPException(
            status_code=409,
            detail={"message": "Duplicate snapshot", "opportunity_id": duplicate.id},
        )
    item = Opportunity(
        workspace_id=user.workspace.id,
        title=captured.title,
        employer=captured.employer,
        description=captured.description,
        source_url=captured.final_url,
        source_kind="url",
        source_sha256=captured.sha256,
        structured_data=captured.structured,
        published_at=captured.published_at,
        deadline_at=captured.deadline_at,
    )
    db.add(item)
    db.flush()
    item.requirements = [
        _requirement(user.workspace.id, item.id, RequirementInput.model_validate(proposal))
        for proposal in propose_requirements(captured.description)
    ]
    record_audit(
        db,
        user,
        "opportunity.url_captured",
        "opportunity",
        item.id,
        {"requirements": len(item.requirements)},
    )
    db.flush()
    return OpportunityRead.model_validate(item)


@router.post("/capture-file", response_model=OpportunityRead, status_code=status.HTTP_201_CREATED)
async def capture_opportunity_file(
    user: CsrfUser,
    db: Db,
    settings: Config,
    file: UploadFile = File(),
    title: str = Form(default=""),
    employer: str = Form(default=""),
) -> OpportunityRead:
    """Capture a bounded job document and keep its private source snapshot and exact hash."""
    content = await file.read(settings.max_upload_bytes + 1)
    if len(content) > settings.max_upload_bytes:
        raise HTTPException(status_code=413, detail="Document exceeds the configured size limit")
    inspection = inspect_content(content, file.content_type, file.filename or "opportunity")
    if not inspection.safe:
        raise HTTPException(status_code=415, detail=inspection.reason)
    if settings.app_env == "production" and not settings.clamav_host:
        raise HTTPException(status_code=503, detail="Malware scanner is required in production")
    clean, scan_result = clamav_scan(content, settings.clamav_host, settings.clamav_port)
    if not clean:
        raise HTTPException(status_code=422, detail="Malware scanner rejected the document")
    stored = FileBlobStore(settings.blob_root).put(user.workspace.id, content)
    try:
        extracted = extract_text(content, inspection.media_type)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    source = Source(
        workspace_id=user.workspace.id,
        kind="opportunity_document",
        label=(file.filename or "Opportunity document")[:300],
        status=SourceStatus.READY,
        media_type=inspection.media_type,
        sha256=stored.sha256,
        storage_key=stored.key,
        extracted_text=extracted,
        source_metadata={"scan": scan_result},
    )
    db.add(source)
    db.flush()
    item = Opportunity(
        workspace_id=user.workspace.id,
        title=(title.strip() or (file.filename or "Captured opportunity"))[:300],
        employer=employer.strip()[:300],
        description=extracted,
        source_kind="file",
        source_sha256=stored.sha256,
        structured_data={"source_id": source.id},
    )
    db.add(item)
    db.flush()
    item.requirements = [
        _requirement(user.workspace.id, item.id, RequirementInput.model_validate(proposal))
        for proposal in propose_requirements(extracted)
    ]
    record_audit(
        db,
        user,
        "opportunity.file_captured",
        "opportunity",
        item.id,
        {"requirements": len(item.requirements), "size": stored.size},
    )
    db.flush()
    return OpportunityRead.model_validate(item)


@router.post("/{opportunity_id}/propose-requirements")
def extract_requirement_proposals(
    opportunity_id: str, user: CsrfUser, db: Db
) -> list[RequirementInput]:
    """Return deterministic requirement proposals without mutating canonical requirements."""
    item = _find(db, user.workspace.id, opportunity_id)
    return [
        RequirementInput.model_validate(value) for value in propose_requirements(item.description)
    ]


@router.delete("/{opportunity_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_opportunity(opportunity_id: str, user: CsrfUser, db: Db) -> None:
    """Delete one tenant-owned opportunity and its dependent matches and applications."""
    result = db.execute(
        delete(Opportunity).where(
            Opportunity.id == opportunity_id, Opportunity.workspace_id == user.workspace.id
        )
    )
    if not getattr(result, "rowcount", 0):
        raise HTTPException(status_code=404, detail="Opportunity not found")
    record_audit(db, user, "opportunity.deleted", "opportunity", opportunity_id)


@router.get("/visualization/landscape")
def opportunity_landscape(user: CurrentUser, db: Db) -> dict[str, object]:
    """Return honest category counts and plot-ready opportunity rows with explicit denominators."""
    items = db.scalars(
        select(Opportunity)
        .options(selectinload(Opportunity.requirements))
        .where(Opportunity.workspace_id == user.workspace.id)
    ).all()
    industries = Counter(item.industry or "Unspecified" for item in items)
    seniority = Counter(item.seniority or "Unspecified" for item in items)
    skills = Counter(
        requirement.normalized_name
        for item in items
        for requirement in item.requirements
        if requirement.category == "skill"
    )
    return {
        "denominator": len(items),
        "industries": dict(industries.most_common()),
        "seniority": dict(seniority.most_common()),
        "skills": dict(skills.most_common(30)),
        "opportunities": [
            {
                "id": item.id,
                "title": item.title,
                "employer": item.employer,
                "industry": item.industry or "Unspecified",
                "seniority": item.seniority or "Unspecified",
                "requirements": len(item.requirements),
                "deadline_at": item.deadline_at,
                "status": item.status.value,
            }
            for item in items
        ],
        "warning": "Counts describe only the opportunities saved by this user, not the labor market.",
    }
