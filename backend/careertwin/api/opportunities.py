"""Opportunity capture, normalization, versioning and visualization endpoints."""

from __future__ import annotations

import hashlib
from collections import Counter
from typing import Any

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from sqlalchemy import delete, select
from sqlalchemy.orm import selectinload

from careertwin.api.dependencies import Config, CsrfUser, CurrentUser, Db
from careertwin.models import (
    Opportunity,
    OpportunitySnapshot,
    Requirement,
    Source,
    SourceStatus,
    TargetSet,
)
from careertwin.schemas import (
    OpportunityCreate,
    OpportunityRead,
    OpportunityUrlCapture,
    RequirementInput,
    TargetSetCreate,
    TargetSetRead,
)
from careertwin.services.audit import record_audit
from careertwin.services.blob import configured_blob_store
from careertwin.services.ingestion import clamav_scan, extract_document, inspect_content
from careertwin.services.normalization import normalize_label
from careertwin.services.opportunity_ingestion import (
    UnsafeUrlError,
    capture_url,
    propose_requirements,
)
from careertwin.services.queue import enqueue_source

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


def _save_snapshot(db: Db, item: Opportunity) -> OpportunitySnapshot:
    """Persist the current reviewed opportunity and requirement revision as an immutable snapshot."""
    snapshot = OpportunitySnapshot(
        workspace_id=item.workspace_id,
        opportunity_id=item.id,
        version=item.version,
        snapshot=OpportunityRead.model_validate(item).model_dump(mode="json"),
        source_sha256=item.source_sha256,
    )
    db.add(snapshot)
    return snapshot


def _validate_target_opportunities(db: Db, workspace_id: str, ids: list[str]) -> list[str]:
    unique = list(dict.fromkeys(ids))
    if not unique:
        return []
    found = set(
        db.scalars(
            select(Opportunity.id).where(
                Opportunity.workspace_id == workspace_id, Opportunity.id.in_(unique)
            )
        ).all()
    )
    if found != set(unique):
        raise HTTPException(
            status_code=400, detail="Every target-set opportunity must belong to this workspace"
        )
    return unique


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


@router.get("/visualization/landscape")
def opportunity_landscape(user: CurrentUser, db: Db) -> dict[str, object]:
    """Return honest category counts and plot-ready rows with explicit denominators."""
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


def _concept_id(kind: str, label: str) -> str:
    digest = hashlib.sha256(f"{kind}:{normalize_label(label)}".encode()).hexdigest()[:20]
    return f"{kind}:{digest}"


@router.get("/visualization/graph")
def opportunity_graph(user: CurrentUser, db: Db) -> dict[str, object]:
    """Project saved opportunity research as a typed, tenant-owned knowledge graph."""
    items = db.scalars(
        select(Opportunity)
        .options(selectinload(Opportunity.requirements))
        .where(Opportunity.workspace_id == user.workspace.id)
        .order_by(Opportunity.updated_at.desc())
    ).all()
    target_sets = db.scalars(
        select(TargetSet).where(TargetSet.workspace_id == user.workspace.id)
    ).all()
    nodes: dict[str, dict[str, Any]] = {}
    edges: list[dict[str, object]] = []

    def add_node(identifier: str, label: str, kind: str, **metadata: object) -> None:
        if identifier not in nodes:
            nodes[identifier] = {"id": identifier, "label": label, "type": kind, **metadata}

    def link(source: str, target: str, relation: str, weight: float = 1) -> None:
        edges.append(
            {
                "id": f"link:{len(edges) + 1}",
                "source": source,
                "target": target,
                "type": relation,
                "weight": weight,
            }
        )

    for item in items:
        opportunity_id = f"opportunity:{item.id}"
        add_node(
            opportunity_id,
            item.title,
            "opportunity",
            employer=item.employer,
            status=item.status.value,
            version=item.version,
            requirement_count=len(item.requirements),
            deadline_at=item.deadline_at,
        )
        for kind, label, relation in (
            ("employer", item.employer, "posted_by"),
            ("industry", item.industry, "in_industry"),
            ("seniority", item.seniority, "targets_seniority"),
            ("location", item.location, "located_in"),
            ("work_mode", item.remote_mode if item.remote_mode != "unspecified" else "", "work_mode"),
        ):
            if not label:
                continue
            concept_id = _concept_id(kind, label)
            add_node(concept_id, label, kind)
            link(opportunity_id, concept_id, relation)
        for requirement in item.requirements:
            label = requirement.normalized_name or normalize_label(requirement.label)
            requirement_id = _concept_id("requirement", f"{requirement.category}:{label}")
            add_node(
                requirement_id,
                requirement.label,
                "requirement",
                category=requirement.category,
                occurrences=0,
                importance=[],
            )
            node = nodes[requirement_id]
            node["occurrences"] = int(node["occurrences"]) + 1
            importance = list(node["importance"])
            if requirement.importance not in importance:
                importance.append(requirement.importance)
            node["importance"] = importance
            link(
                opportunity_id,
                requirement_id,
                f"requires_{requirement.importance}",
                max(0.2, requirement.weight),
            )

    available = {item.id for item in items}
    for target_set in target_sets:
        target_id = f"target_set:{target_set.id}"
        add_node(
            target_id,
            target_set.name,
            "target_set",
            opportunity_count=len([item for item in target_set.opportunity_ids if item in available]),
        )
        for opportunity_id in target_set.opportunity_ids:
            if opportunity_id in available:
                link(target_id, f"opportunity:{opportunity_id}", "contains")

    return {
        "graph": {"nodes": list(nodes.values()), "edges": edges},
        "summary": {
            "opportunities": len(items),
            "requirements": sum(1 for node in nodes.values() if node["type"] == "requirement"),
            "target_sets": len(target_sets),
        },
        "warning": "This graph describes only the opportunities saved by this user.",
    }


@router.get("/target-sets", response_model=list[TargetSetRead])
def list_target_sets(user: CurrentUser, db: Db) -> list[TargetSetRead]:
    """List named opportunity portfolios and their explicit scenario assumptions."""
    items = db.scalars(
        select(TargetSet)
        .where(TargetSet.workspace_id == user.workspace.id)
        .order_by(TargetSet.updated_at.desc())
    ).all()
    return [TargetSetRead.model_validate(item) for item in items]


@router.post("/target-sets", response_model=TargetSetRead, status_code=status.HTTP_201_CREATED)
def create_target_set(payload: TargetSetCreate, user: CsrfUser, db: Db) -> TargetSetRead:
    """Create a tenant-owned portfolio from already saved opportunities."""
    item = TargetSet(
        workspace_id=user.workspace.id,
        **payload.model_dump(exclude={"opportunity_ids"}),
        opportunity_ids=_validate_target_opportunities(
            db, user.workspace.id, payload.opportunity_ids
        ),
    )
    db.add(item)
    db.flush()
    record_audit(db, user, "target_set.created", "target_set", item.id)
    return TargetSetRead.model_validate(item)


@router.put("/target-sets/{target_set_id}", response_model=TargetSetRead)
def update_target_set(
    target_set_id: str, payload: TargetSetCreate, user: CsrfUser, db: Db
) -> TargetSetRead:
    """Replace a target-set definition without mutating its constituent opportunities."""
    item = db.scalar(
        select(TargetSet).where(
            TargetSet.id == target_set_id, TargetSet.workspace_id == user.workspace.id
        )
    )
    if not item:
        raise HTTPException(status_code=404, detail="Target set not found")
    item.name = payload.name
    item.description = payload.description
    item.strategy = payload.strategy
    item.opportunity_ids = _validate_target_opportunities(
        db, user.workspace.id, payload.opportunity_ids
    )
    record_audit(db, user, "target_set.updated", "target_set", item.id)
    return TargetSetRead.model_validate(item)


@router.delete("/target-sets/{target_set_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_target_set(target_set_id: str, user: CsrfUser, db: Db) -> None:
    """Delete a target-set scenario without deleting saved opportunities."""
    result = db.execute(
        delete(TargetSet).where(
            TargetSet.id == target_set_id, TargetSet.workspace_id == user.workspace.id
        )
    )
    if not getattr(result, "rowcount", 0):
        raise HTTPException(status_code=404, detail="Target set not found")
    record_audit(db, user, "target_set.deleted", "target_set", target_set_id)


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
    _save_snapshot(db, item)
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
    _save_snapshot(db, item)
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
    _save_snapshot(db, item)
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
    stored = configured_blob_store(settings).put(user.workspace.id, content)
    source = Source(
        workspace_id=user.workspace.id,
        kind="opportunity_document",
        label=(file.filename or "Opportunity document")[:300],
        status=SourceStatus.PENDING,
        media_type=inspection.media_type,
        sha256=stored.sha256,
        storage_key=stored.key,
        extracted_text=None,
        source_metadata={
            "scan": scan_result,
            "original_name": (file.filename or "opportunity")[:300],
        },
    )
    db.add(source)
    db.flush()
    item = Opportunity(
        workspace_id=user.workspace.id,
        title=(title.strip() or (file.filename or "Captured opportunity"))[:300],
        employer=employer.strip()[:300],
        description="",
        source_kind="file",
        source_sha256=stored.sha256,
        structured_data={"source_id": source.id, "capture_status": "pending"},
    )
    db.add(item)
    db.flush()
    source.source_metadata = {**source.source_metadata, "opportunity_id": item.id}
    if settings.app_env == "test":
        try:
            extraction = extract_document(
                content, inspection.media_type, file.filename or "opportunity", settings
            )
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        source.extracted_text = extraction.text
        source.status = SourceStatus.READY
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
        item.description = extraction.text
        item.structured_data = {**item.structured_data, "capture_status": "ready"}
        item.requirements = [
            _requirement(user.workspace.id, item.id, RequirementInput.model_validate(proposal))
            for proposal in propose_requirements(extraction.text)
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
    _save_snapshot(db, item)
    if settings.app_env != "test":
        db.commit()
        try:
            await enqueue_source(settings, user.workspace.id, source.id)
        except Exception as exc:
            raise HTTPException(
                status_code=503,
                detail="Opportunity is stored safely but extraction could not be queued; retry it.",
            ) from exc
    return OpportunityRead.model_validate(item)


@router.get("/{opportunity_id}/history")
def opportunity_history(opportunity_id: str, user: CurrentUser, db: Db) -> list[dict[str, object]]:
    """Return immutable reviewed opportunity revisions, newest first."""
    _find(db, user.workspace.id, opportunity_id)
    snapshots = db.scalars(
        select(OpportunitySnapshot)
        .where(
            OpportunitySnapshot.workspace_id == user.workspace.id,
            OpportunitySnapshot.opportunity_id == opportunity_id,
        )
        .order_by(OpportunitySnapshot.version.desc())
    ).all()
    return [
        {
            "id": item.id,
            "version": item.version,
            "source_sha256": item.source_sha256,
            "snapshot": item.snapshot,
            "created_at": item.created_at,
        }
        for item in snapshots
    ]


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
    target_sets = db.scalars(
        select(TargetSet).where(TargetSet.workspace_id == user.workspace.id)
    ).all()
    for target_set in target_sets:
        if opportunity_id in target_set.opportunity_ids:
            target_set.opportunity_ids = [
                item for item in target_set.opportunity_ids if item != opportunity_id
            ]
    result = db.execute(
        delete(Opportunity).where(
            Opportunity.id == opportunity_id, Opportunity.workspace_id == user.workspace.id
        )
    )
    if not getattr(result, "rowcount", 0):
        raise HTTPException(status_code=404, detail="Opportunity not found")
    record_audit(db, user, "opportunity.deleted", "opportunity", opportunity_id)
