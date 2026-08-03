"""Professional profile, evidence review and graph projection endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Body, File, Form, HTTPException, UploadFile, status
from sqlalchemy import delete, select
from sqlalchemy.orm import selectinload

from careertwin.api.dependencies import Config, CsrfUser, CurrentUser, Db
from careertwin.models import (
    Accomplishment,
    ClaimState,
    Education,
    EvidenceClaim,
    Experience,
    ProfessionalProfile,
    Skill,
    Source,
    SourceStatus,
    utcnow,
)
from careertwin.schemas import (
    ClaimDecision,
    ClaimProposal,
    ClaimRead,
    EducationCreate,
    ExperienceCreate,
    ProfileRead,
    ProfileUpdate,
    SkillCreate,
    SkillRead,
    SourceRead,
)
from careertwin.services.audit import record_audit
from careertwin.services.blob import configured_blob_store
from careertwin.services.graph import build_career_river, build_profile_graph
from careertwin.services.ingestion import (
    clamav_scan,
    extract_document,
    inspect_content,
    propose_profile_claims,
)
from careertwin.services.interchange import (
    InterchangeError,
    export_json_resume,
    export_profile_interchange,
    import_json_resume,
    import_profile_interchange,
    validate_json_object,
)
from careertwin.services.normalization import normalize_label
from careertwin.services.queue import enqueue_source

router = APIRouter(prefix="/api/profile", tags=["professional profile"])


def _profile(db: Db, user: CurrentUser) -> ProfessionalProfile:
    profile = db.scalar(
        select(ProfessionalProfile).where(ProfessionalProfile.workspace_id == user.workspace.id)
    )
    if not profile:
        raise HTTPException(status_code=500, detail="Profile workspace is not initialized")
    return profile


def _skill_read(skill: Skill) -> SkillRead:
    return SkillRead(
        id=skill.id,
        name=skill.name,
        normalized_name=skill.normalized_name,
        taxonomy_uri=skill.taxonomy_uri,
        level=skill.level,
        years=skill.years,
        confidence=skill.confidence,
        category=skill.category,
        evidence_count=len(skill.evidence),
    )


@router.get("", response_model=ProfileRead)
def read_profile(user: CurrentUser, db: Db) -> ProfileRead:
    """Read the current account's single professional profile."""
    return ProfileRead.model_validate(_profile(db, user))


@router.put("", response_model=ProfileRead)
def update_profile(payload: ProfileUpdate, user: CsrfUser, db: Db) -> ProfileRead:
    """Update curated profile fields with optimistic revision conflict detection."""
    profile = _profile(db, user)
    if payload.revision != profile.revision:
        raise HTTPException(status_code=409, detail="Profile changed; reload before saving")
    for field, value in payload.model_dump(exclude={"revision"}).items():
        setattr(profile, field, value)
    profile.revision += 1
    record_audit(
        db,
        user,
        "profile.updated",
        "professional_profile",
        profile.id,
        {"revision": profile.revision},
    )
    db.flush()
    return ProfileRead.model_validate(profile)


@router.get("/skills", response_model=list[SkillRead])
def list_skills(user: CurrentUser, db: Db) -> list[SkillRead]:
    """List tenant-scoped skills and confirmed evidence counts."""
    items = db.scalars(
        select(Skill)
        .options(selectinload(Skill.evidence))
        .where(Skill.workspace_id == user.workspace.id)
        .order_by(Skill.level.desc(), Skill.name)
    ).all()
    return [_skill_read(item) for item in items]


@router.post("/skills", response_model=SkillRead, status_code=status.HTTP_201_CREATED)
def add_skill(payload: SkillCreate, user: CsrfUser, db: Db) -> SkillRead:
    """Add or replace a manually curated skill using explicit evidence links only."""
    normalized = normalize_label(payload.name)
    existing = db.scalar(
        select(Skill).where(
            Skill.workspace_id == user.workspace.id, Skill.normalized_name == normalized
        )
    )
    if existing:
        raise HTTPException(status_code=409, detail="Skill already exists")
    evidence: list[EvidenceClaim] = []
    if payload.evidence_ids:
        evidence = list(
            db.scalars(
                select(EvidenceClaim).where(
                    EvidenceClaim.workspace_id == user.workspace.id,
                    EvidenceClaim.id.in_(payload.evidence_ids),
                    EvidenceClaim.state == ClaimState.CONFIRMED,
                )
            ).all()
        )
        if len(evidence) != len(set(payload.evidence_ids)):
            raise HTTPException(
                status_code=400, detail="Every evidence link must be a confirmed tenant claim"
            )
    item = Skill(
        workspace_id=user.workspace.id,
        name=payload.name.strip(),
        normalized_name=normalized,
        taxonomy_uri=payload.taxonomy_uri,
        level=payload.level,
        years=payload.years,
        confidence=payload.confidence,
        category=payload.category,
        evidence=list(evidence),
    )
    db.add(item)
    db.flush()
    record_audit(db, user, "profile.skill_added", "skill", item.id)
    return _skill_read(item)


@router.delete("/skills/{skill_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_skill(skill_id: str, user: CsrfUser, db: Db) -> None:
    """Delete one tenant-owned curated skill without deleting its source evidence."""
    result = db.execute(
        delete(Skill).where(Skill.id == skill_id, Skill.workspace_id == user.workspace.id)
    )
    if not getattr(result, "rowcount", 0):
        raise HTTPException(status_code=404, detail="Skill not found")
    record_audit(db, user, "profile.skill_deleted", "skill", skill_id)


@router.get("/experiences")
def list_experiences(user: CurrentUser, db: Db) -> list[dict[str, object]]:
    """List curated experiences in reverse chronological order."""
    items = db.scalars(
        select(Experience)
        .where(Experience.workspace_id == user.workspace.id)
        .order_by(Experience.start_date.desc())
    ).all()
    return [
        {
            column.name: getattr(item, column.name)
            for column in Experience.__table__.columns
            if column.name != "workspace_id"
        }
        for item in items
    ]


@router.post("/experiences", status_code=status.HTTP_201_CREATED)
def add_experience(payload: ExperienceCreate, user: CsrfUser, db: Db) -> dict[str, object]:
    """Add a manually curated professional experience."""
    item = Experience(workspace_id=user.workspace.id, **payload.model_dump())
    db.add(item)
    db.flush()
    record_audit(db, user, "profile.experience_added", "experience", item.id)
    return {
        column.name: getattr(item, column.name)
        for column in Experience.__table__.columns
        if column.name != "workspace_id"
    }


@router.delete("/experiences/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_experience(item_id: str, user: CsrfUser, db: Db) -> None:
    """Delete a tenant-owned experience record."""
    result = db.execute(
        delete(Experience).where(
            Experience.id == item_id, Experience.workspace_id == user.workspace.id
        )
    )
    if not getattr(result, "rowcount", 0):
        raise HTTPException(status_code=404, detail="Experience not found")
    record_audit(db, user, "profile.experience_deleted", "experience", item_id)


@router.get("/education")
def list_education(user: CurrentUser, db: Db) -> list[dict[str, object]]:
    """List curated education and credentials."""
    items = db.scalars(
        select(Education)
        .where(Education.workspace_id == user.workspace.id)
        .order_by(Education.start_date.desc())
    ).all()
    return [
        {
            column.name: getattr(item, column.name)
            for column in Education.__table__.columns
            if column.name != "workspace_id"
        }
        for item in items
    ]


@router.post("/education", status_code=status.HTTP_201_CREATED)
def add_education(payload: EducationCreate, user: CsrfUser, db: Db) -> dict[str, object]:
    """Add a manually curated education or credential record."""
    item = Education(workspace_id=user.workspace.id, **payload.model_dump())
    db.add(item)
    db.flush()
    record_audit(db, user, "profile.education_added", "education", item.id)
    return {
        column.name: getattr(item, column.name)
        for column in Education.__table__.columns
        if column.name != "workspace_id"
    }


@router.delete("/education/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_education(item_id: str, user: CsrfUser, db: Db) -> None:
    """Delete a tenant-owned education or credential record."""
    result = db.execute(
        delete(Education).where(
            Education.id == item_id, Education.workspace_id == user.workspace.id
        )
    )
    if not getattr(result, "rowcount", 0):
        raise HTTPException(status_code=404, detail="Education record not found")
    record_audit(db, user, "profile.education_deleted", "education", item_id)


@router.get("/claims", response_model=list[ClaimRead])
def list_claims(user: CurrentUser, db: Db, state: ClaimState | None = None) -> list[ClaimRead]:
    """List reviewable evidence claims, optionally filtered by lifecycle state."""
    query = select(EvidenceClaim).where(EvidenceClaim.workspace_id == user.workspace.id)
    if state:
        query = query.where(EvidenceClaim.state == state)
    claims = db.scalars(query.order_by(EvidenceClaim.created_at.desc())).all()
    return [ClaimRead.model_validate(claim) for claim in claims]


@router.post("/claims", response_model=ClaimRead, status_code=status.HTTP_201_CREATED)
def propose_claim(payload: ClaimProposal, user: CsrfUser, db: Db) -> ClaimRead:
    """Create a manual or machine proposal; canonical graph use still requires confirmation."""
    if payload.source_id:
        source = db.scalar(
            select(Source).where(
                Source.id == payload.source_id, Source.workspace_id == user.workspace.id
            )
        )
        if not source:
            raise HTTPException(status_code=400, detail="Source does not belong to this workspace")
    claim = EvidenceClaim(workspace_id=user.workspace.id, **payload.model_dump())
    db.add(claim)
    db.flush()
    record_audit(db, user, "evidence.claim_proposed", "evidence_claim", claim.id)
    return ClaimRead.model_validate(claim)


@router.post("/claims/{claim_id}/decision", response_model=ClaimRead)
def decide_claim(claim_id: str, payload: ClaimDecision, user: CsrfUser, db: Db) -> ClaimRead:
    """Confirm or reject one proposed claim; this is the canonical human approval gate."""
    claim = db.scalar(
        select(EvidenceClaim).where(
            EvidenceClaim.id == claim_id, EvidenceClaim.workspace_id == user.workspace.id
        )
    )
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    if claim.state != ClaimState.PROPOSED:
        raise HTTPException(status_code=409, detail="Only proposed claims may be decided")
    claim.state = ClaimState(payload.decision)
    claim.decided_at = utcnow()
    claim.decision_note = payload.note
    record_audit(db, user, f"evidence.claim_{payload.decision}", "evidence_claim", claim.id)
    return ClaimRead.model_validate(claim)


@router.get("/sources", response_model=list[SourceRead])
def list_sources(user: CurrentUser, db: Db) -> list[SourceRead]:
    """List source metadata without exposing private storage paths or extracted contents."""
    items = db.scalars(
        select(Source)
        .where(Source.workspace_id == user.workspace.id)
        .order_by(Source.created_at.desc())
    ).all()
    return [SourceRead.model_validate(item) for item in items]


@router.get("/interchange")
def profile_interchange(user: CurrentUser, db: Db) -> dict[str, object]:
    """Export the lossless, versioned CareerTwin profile and evidence interchange document."""
    return export_profile_interchange(db, user.workspace.id)


@router.post("/interchange/import")
def import_interchange(
    user: CsrfUser, db: Db, payload: object = Body(), replace: bool = True
) -> dict[str, object]:
    """Import a validated CareerTwin profile while remapping tenant-local evidence references."""
    try:
        result = import_profile_interchange(
            db, user.workspace.id, validate_json_object(payload), replace=replace
        )
    except InterchangeError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    record_audit(
        db,
        user,
        "profile.interchange_imported",
        "professional_profile",
        user.workspace.profile.id,
        result,
    )
    return {"status": "imported", "counts": result}


@router.get("/json-resume")
def json_resume(user: CurrentUser, db: Db) -> dict[str, object]:
    """Export standards-based JSON Resume with a lossless namespaced CareerTwin extension."""
    return export_json_resume(
        db, user.workspace.id, display_name=user.display_name, email=user.email
    )


@router.post("/json-resume/import")
def import_resume(user: CsrfUser, db: Db, payload: object = Body()) -> dict[str, object]:
    """Import JSON Resume; preserve the full CareerTwin extension when it is supplied."""
    try:
        result = import_json_resume(db, user.workspace.id, validate_json_object(payload))
    except InterchangeError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    record_audit(
        db,
        user,
        "profile.json_resume_imported",
        "professional_profile",
        user.workspace.profile.id,
        result,
    )
    return {"status": "imported", "counts": result}


@router.post("/sources/upload", response_model=SourceRead, status_code=status.HTTP_201_CREATED)
async def upload_source(
    user: CsrfUser,
    db: Db,
    settings: Config,
    file: UploadFile = File(),
    label: str = Form(default=""),
) -> SourceRead:
    """Inspect, scan, store and extract a bounded document, leaving all claims proposed."""
    content = await file.read(settings.max_upload_bytes + 1)
    if len(content) > settings.max_upload_bytes:
        raise HTTPException(status_code=413, detail="Document exceeds the configured size limit")
    inspection = inspect_content(content, file.content_type, file.filename or "upload")
    source = Source(
        workspace_id=user.workspace.id,
        kind="document",
        label=(label.strip() or file.filename or "Uploaded document")[:300],
        status=SourceStatus.QUARANTINED,
        media_type=inspection.media_type,
        source_metadata={"original_name": (file.filename or "upload")[:300]},
    )
    db.add(source)
    db.flush()
    if not inspection.safe:
        source.status = SourceStatus.FAILED
        source.error = inspection.reason
        raise HTTPException(status_code=415, detail=inspection.reason)
    if settings.app_env == "production" and not settings.clamav_host:
        source.status = SourceStatus.FAILED
        source.error = "Malware scanner is required in production"
        raise HTTPException(status_code=503, detail=source.error)
    clean, scan_result = clamav_scan(content, settings.clamav_host, settings.clamav_port)
    source.source_metadata = {**source.source_metadata, "scan": scan_result}
    if not clean:
        source.status = SourceStatus.FAILED
        source.error = "Malware scanner rejected the document"
        raise HTTPException(status_code=422, detail=source.error)
    stored = configured_blob_store(settings).put(user.workspace.id, content)
    source.storage_key, source.sha256 = stored.key, stored.sha256
    source.status = SourceStatus.PENDING
    if settings.app_env == "test":
        try:
            extraction = extract_document(
                content, inspection.media_type, file.filename or "upload", settings
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
            source.status = SourceStatus.READY
            for proposal in propose_profile_claims(source.extracted_text, source.id):
                db.add(EvidenceClaim(workspace_id=user.workspace.id, **proposal))
        except ValueError as exc:
            source.status = SourceStatus.FAILED
            source.error = str(exc)
    record_audit(
        db,
        user,
        "source.ingested",
        "source",
        source.id,
        {"media_type": inspection.media_type, "size": stored.size},
    )
    db.flush()
    if settings.app_env != "test":
        db.commit()
        try:
            await enqueue_source(settings, user.workspace.id, source.id)
        except Exception as exc:
            raise HTTPException(
                status_code=503,
                detail="Document is stored safely but extraction could not be queued; retry it.",
            ) from exc
    return SourceRead.model_validate(source)


@router.post("/sources/{source_id}/retry", response_model=SourceRead)
async def retry_source(source_id: str, user: CsrfUser, db: Db, settings: Config) -> SourceRead:
    """Retry a failed or pending source through the durable extraction worker."""
    source = db.scalar(
        select(Source).where(
            Source.id == source_id,
            Source.workspace_id == user.workspace.id,
        )
    )
    if not source or not source.storage_key:
        raise HTTPException(status_code=404, detail="Stored source not found")
    source.status = SourceStatus.PENDING
    source.error = None
    record_audit(db, user, "source.retry_queued", "source", source.id)
    db.commit()
    try:
        await enqueue_source(settings, user.workspace.id, source.id)
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Extraction queue is unavailable") from exc
    return SourceRead.model_validate(source)


@router.get("/graph")
def profile_graph(user: CurrentUser, db: Db) -> dict[str, object]:
    """Return network, career-river and evidence-matrix projections with stable IDs."""
    profile = _profile(db, user)
    skills = list(
        db.scalars(
            select(Skill)
            .options(selectinload(Skill.evidence))
            .where(Skill.workspace_id == user.workspace.id)
        ).all()
    )
    experiences = list(
        db.scalars(select(Experience).where(Experience.workspace_id == user.workspace.id)).all()
    )
    education = list(
        db.scalars(select(Education).where(Education.workspace_id == user.workspace.id)).all()
    )
    claims = list(
        db.scalars(
            select(EvidenceClaim).where(
                EvidenceClaim.workspace_id == user.workspace.id,
                EvidenceClaim.state == ClaimState.CONFIRMED,
            )
        ).all()
    )
    sources = list(
        db.scalars(select(Source).where(Source.workspace_id == user.workspace.id)).all()
    )
    accomplishments = list(
        db.scalars(
            select(Accomplishment).where(Accomplishment.workspace_id == user.workspace.id)
        ).all()
    )
    matrix = [
        {
            "skill_id": skill.id,
            "skill": skill.name,
            "level": skill.level,
            "confidence": skill.confidence,
            "evidence": [
                {"id": claim.id, "statement": claim.statement, "source_id": claim.source_id}
                for claim in skill.evidence
            ],
        }
        for skill in skills
    ]
    return {
        "graph": build_profile_graph(
            profile, skills, experiences, education, claims, sources, accomplishments
        ),
        "river": build_career_river(experiences, education),
        "matrix": matrix,
    }
