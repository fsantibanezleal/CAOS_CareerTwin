"""Lossless profile interchange and standards-based JSON Resume conversion."""

from __future__ import annotations

import hashlib
import json
from typing import Any

from pydantic import TypeAdapter, ValidationError
from sqlalchemy import delete, select
from sqlalchemy.orm import Session, selectinload

from careertwin.models import (
    ClaimState,
    Education,
    EvidenceClaim,
    Experience,
    ProfessionalProfile,
    Skill,
    Source,
    SourceStatus,
)
from careertwin.schemas import EducationCreate, ExperienceCreate, ProfileUpdate, SkillCreate
from careertwin.services.normalization import normalize_label

SCHEMA_VERSION = "1.0"


class InterchangeError(ValueError):
    """Raised when a profile interchange document violates the public contract."""


def export_profile_interchange(db: Session, workspace_id: str) -> dict[str, Any]:
    """Return a portable profile/evidence document without private blob or extracted-text fields."""
    profile = db.scalar(
        select(ProfessionalProfile).where(ProfessionalProfile.workspace_id == workspace_id)
    )
    if not profile:
        raise InterchangeError("Profile is not initialized")
    sources = list(
        db.scalars(
            select(Source).where(Source.workspace_id == workspace_id).order_by(Source.created_at)
        ).all()
    )
    claims = list(
        db.scalars(
            select(EvidenceClaim)
            .where(EvidenceClaim.workspace_id == workspace_id)
            .order_by(EvidenceClaim.created_at)
        ).all()
    )
    skills = list(
        db.scalars(
            select(Skill)
            .options(selectinload(Skill.evidence))
            .where(Skill.workspace_id == workspace_id)
            .order_by(Skill.normalized_name)
        ).all()
    )
    experiences = list(
        db.scalars(
            select(Experience)
            .where(Experience.workspace_id == workspace_id)
            .order_by(Experience.start_date)
        ).all()
    )
    education = list(
        db.scalars(
            select(Education)
            .where(Education.workspace_id == workspace_id)
            .order_by(Education.start_date)
        ).all()
    )
    return {
        "format": "CareerTwin profile",
        "schema_version": SCHEMA_VERSION,
        "profile": {
            "headline": profile.headline,
            "summary": profile.summary,
            "location": profile.location,
            "seniority": profile.seniority,
            "years_experience": profile.years_experience,
            "availability": profile.availability,
            "preferences": profile.preferences,
            "links": profile.links,
        },
        "sources": [
            {
                "ref": item.id,
                "kind": item.kind,
                "label": item.label,
                "status": item.status.value,
                "media_type": item.media_type,
                "sha256": item.sha256,
                "source_url": item.source_url,
                "source_metadata": item.source_metadata,
                "error": item.error,
            }
            for item in sources
        ],
        "claims": [
            {
                "ref": item.id,
                "source_ref": item.source_id,
                "claim_type": item.claim_type,
                "statement": item.statement,
                "normalized_value": item.normalized_value,
                "source_locator": item.source_locator,
                "confidence": item.confidence,
                "state": item.state.value,
                "decision_note": item.decision_note,
            }
            for item in claims
        ],
        "skills": [
            {
                "name": item.name,
                "taxonomy_uri": item.taxonomy_uri,
                "level": item.level,
                "years": item.years,
                "confidence": item.confidence,
                "category": item.category,
                "evidence_refs": [claim.id for claim in item.evidence],
            }
            for item in skills
        ],
        "experiences": [
            {
                "organization": item.organization,
                "role": item.role,
                "start_date": item.start_date,
                "end_date": item.end_date,
                "current": item.current,
                "summary": item.summary,
                "achievements": item.achievements,
                "skills": item.skills,
            }
            for item in experiences
        ],
        "education": [
            {
                "institution": item.institution,
                "credential": item.credential,
                "field": item.field,
                "start_date": item.start_date,
                "end_date": item.end_date,
                "details": item.details,
            }
            for item in education
        ],
    }


def _list(document: dict[str, Any], key: str, limit: int) -> list[dict[str, Any]]:
    value = document.get(key, [])
    if (
        not isinstance(value, list)
        or len(value) > limit
        or any(not isinstance(row, dict) for row in value)
    ):
        raise InterchangeError(f"{key} must be a list of at most {limit} objects")
    return value


def import_profile_interchange(
    db: Session, workspace_id: str, document: dict[str, Any], *, replace: bool = True
) -> dict[str, int]:
    """Validate and import a portable profile while remapping every source/evidence reference."""
    if (
        document.get("format") != "CareerTwin profile"
        or document.get("schema_version") != SCHEMA_VERSION
    ):
        raise InterchangeError("Unsupported CareerTwin profile format or schema version")
    profile_payload = document.get("profile")
    if not isinstance(profile_payload, dict):
        raise InterchangeError("profile must be an object")
    try:
        current = db.scalar(
            select(ProfessionalProfile).where(ProfessionalProfile.workspace_id == workspace_id)
        )
        if not current:
            raise InterchangeError("Profile is not initialized")
        validated_profile = ProfileUpdate.model_validate(
            {**profile_payload, "revision": current.revision}
        )
        source_rows = _list(document, "sources", 500)
        claim_rows = _list(document, "claims", 5000)
        skill_rows = _list(document, "skills", 1000)
        experience_rows = [
            ExperienceCreate.model_validate(row) for row in _list(document, "experiences", 500)
        ]
        education_rows = [
            EducationCreate.model_validate(row) for row in _list(document, "education", 500)
        ]
        validated_skills = [
            SkillCreate.model_validate({**row, "evidence_ids": []}) for row in skill_rows
        ]
    except ValidationError as exc:
        raise InterchangeError(
            f"Invalid CareerTwin profile document: {exc.errors()[0]['msg']}"
        ) from exc

    if replace:
        db.execute(delete(Skill).where(Skill.workspace_id == workspace_id))
        db.execute(delete(Experience).where(Experience.workspace_id == workspace_id))
        db.execute(delete(Education).where(Education.workspace_id == workspace_id))
        db.execute(delete(EvidenceClaim).where(EvidenceClaim.workspace_id == workspace_id))
        db.execute(delete(Source).where(Source.workspace_id == workspace_id))
        db.flush()

    for field, value in validated_profile.model_dump(exclude={"revision"}).items():
        setattr(current, field, value)
    current.revision += 1

    source_map: dict[str, Source] = {}
    for row in source_rows:
        old_ref = str(row.get("ref", ""))
        try:
            status = SourceStatus(str(row.get("status", SourceStatus.READY.value)))
        except ValueError as exc:
            raise InterchangeError("A source has an unsupported status") from exc
        source = Source(
            workspace_id=workspace_id,
            kind=str(row.get("kind", "import"))[:40],
            label=str(row.get("label", "Imported source"))[:300],
            status=status,
            media_type=str(row["media_type"])[:160] if row.get("media_type") else None,
            sha256=str(row["sha256"])[:64] if row.get("sha256") else None,
            source_url=str(row["source_url"])[:5000] if row.get("source_url") else None,
            source_metadata=row.get("source_metadata")
            if isinstance(row.get("source_metadata"), dict)
            else {},
            error=str(row["error"])[:2000] if row.get("error") else None,
        )
        db.add(source)
        db.flush()
        if old_ref:
            source_map[old_ref] = source

    claim_map: dict[str, EvidenceClaim] = {}
    for row in claim_rows:
        old_ref = str(row.get("ref", ""))
        source_ref = str(row.get("source_ref", ""))
        try:
            state = ClaimState(str(row.get("state", ClaimState.PROPOSED.value)))
        except ValueError as exc:
            raise InterchangeError("A claim has an unsupported review state") from exc
        statement = str(row.get("statement", "")).strip()
        if not statement or len(statement) > 20_000:
            raise InterchangeError("Every claim needs a statement of at most 20000 characters")
        claim = EvidenceClaim(
            workspace_id=workspace_id,
            source_id=source_map[source_ref].id if source_ref in source_map else None,
            claim_type=str(row.get("claim_type", "other"))[:80],
            statement=statement,
            normalized_value=row.get("normalized_value")
            if isinstance(row.get("normalized_value"), dict)
            else {},
            source_locator=row.get("source_locator")
            if isinstance(row.get("source_locator"), dict)
            else {},
            confidence=max(0.0, min(1.0, float(row.get("confidence", 0.5)))),
            state=state,
            decision_note=str(row["decision_note"])[:2000] if row.get("decision_note") else None,
        )
        db.add(claim)
        db.flush()
        if old_ref:
            claim_map[old_ref] = claim

    for row, validated in zip(skill_rows, validated_skills, strict=True):
        evidence = [
            claim_map[ref]
            for ref in (str(value) for value in row.get("evidence_refs", []))
            if ref in claim_map and claim_map[ref].state == ClaimState.CONFIRMED
        ]
        db.add(
            Skill(
                workspace_id=workspace_id,
                name=validated.name,
                normalized_name=normalize_label(validated.name),
                taxonomy_uri=validated.taxonomy_uri,
                level=validated.level,
                years=validated.years,
                confidence=validated.confidence,
                category=validated.category,
                evidence=evidence,
            )
        )
    db.add_all(
        [Experience(workspace_id=workspace_id, **item.model_dump()) for item in experience_rows]
    )
    db.add_all(
        [Education(workspace_id=workspace_id, **item.model_dump()) for item in education_rows]
    )
    return {
        "sources": len(source_rows),
        "claims": len(claim_rows),
        "skills": len(skill_rows),
        "experiences": len(experience_rows),
        "education": len(education_rows),
    }


def export_json_resume(
    db: Session, workspace_id: str, *, display_name: str, email: str
) -> dict[str, Any]:
    """Return JSON Resume fields plus a lossless namespaced CareerTwin extension."""
    interchange = export_profile_interchange(db, workspace_id)
    profile = interchange["profile"]
    assert isinstance(profile, dict)
    return {
        "basics": {
            "name": display_name,
            "label": profile["headline"],
            "email": email,
            "summary": profile["summary"],
            "location": {"city": profile["location"]},
            "profiles": profile["links"],
        },
        "work": [
            {
                "name": item["organization"],
                "position": item["role"],
                "startDate": item["start_date"],
                "endDate": item["end_date"] or "",
                "summary": item["summary"],
                "highlights": [
                    value
                    if isinstance(value, str)
                    else str(value.get("statement") or value.get("text") or "")
                    for value in item["achievements"]
                ],
            }
            for item in interchange["experiences"]
        ],
        "education": [
            {
                "institution": item["institution"],
                "studyType": item["credential"],
                "area": item["field"],
                "startDate": item["start_date"],
                "endDate": item["end_date"] or "",
            }
            for item in interchange["education"]
        ],
        "skills": [
            {
                "name": item["name"],
                "level": str(item["level"]),
                "keywords": [item["category"]],
            }
            for item in interchange["skills"]
        ],
        "meta": {"canonical": "https://jsonresume.org/schema", "version": "v1.0.0"},
        "x-careertwin": interchange,
    }


def import_json_resume(db: Session, workspace_id: str, document: dict[str, Any]) -> dict[str, int]:
    """Import standard JSON Resume data, preferring the lossless CareerTwin extension when present."""
    extension = document.get("x-careertwin")
    if isinstance(extension, dict):
        return import_profile_interchange(db, workspace_id, extension, replace=True)
    basics = document.get("basics", {})
    if not isinstance(basics, dict):
        raise InterchangeError("JSON Resume basics must be an object")
    work = _list(document, "work", 500)
    education = _list(document, "education", 500)
    skills = _list(document, "skills", 1000)
    location = basics.get("location", {})
    city = location.get("city", "") if isinstance(location, dict) else ""
    profiles = basics.get("profiles", [])
    if not isinstance(profiles, list):
        profiles = []
    imported = {
        "format": "CareerTwin profile",
        "schema_version": SCHEMA_VERSION,
        "profile": {
            "headline": str(basics.get("label", "")),
            "summary": str(basics.get("summary", "")),
            "location": str(city),
            "seniority": "",
            "years_experience": 0,
            "availability": "",
            "preferences": {},
            "links": profiles,
        },
        "sources": [],
        "claims": [],
        "skills": [
            {
                "name": str(item.get("name", "")),
                "level": _json_resume_level(item.get("level")),
                "years": 0,
                "confidence": 0.5,
                "category": str((item.get("keywords") or ["technical"])[0]),
                "evidence_refs": [],
            }
            for item in skills
        ],
        "experiences": [
            {
                "organization": str(item.get("name", "")),
                "role": str(item.get("position", "")),
                "start_date": str(item.get("startDate", ""))[:10],
                "end_date": str(item.get("endDate", ""))[:10] or None,
                "current": not bool(item.get("endDate")),
                "summary": str(item.get("summary", "")),
                "achievements": [
                    {"statement": str(value)} for value in item.get("highlights", []) if str(value)
                ],
                "skills": [],
            }
            for item in work
        ],
        "education": [
            {
                "institution": str(item.get("institution", "")),
                "credential": str(item.get("studyType", "")),
                "field": str(item.get("area", "")),
                "start_date": str(item.get("startDate", ""))[:10],
                "end_date": str(item.get("endDate", ""))[:10] or None,
                "details": "",
            }
            for item in education
        ],
    }
    digest = hashlib.sha256(json.dumps(document, sort_keys=True).encode()).hexdigest()
    imported["sources"] = [
        {
            "ref": "json-resume",
            "kind": "json_resume",
            "label": "Imported JSON Resume",
            "status": "ready",
            "media_type": "application/json",
            "sha256": digest,
            "source_metadata": {"schema": "jsonresume-v1"},
        }
    ]
    return import_profile_interchange(db, workspace_id, imported, replace=True)


def _json_resume_level(value: object) -> float:
    """Convert common JSON Resume level strings without pretending to precise proficiency."""
    if isinstance(value, (int, float)):
        return max(0.0, min(1.0, float(value)))
    text = str(value or "").casefold()
    mapping = {"beginner": 0.25, "intermediate": 0.5, "advanced": 0.75, "expert": 0.9}
    return mapping.get(text, 0.5)


def validate_json_object(value: object) -> dict[str, Any]:
    """Reject non-object request bodies before import services inspect nested fields."""
    try:
        return TypeAdapter(dict[str, Any]).validate_python(value)
    except ValidationError as exc:
        raise InterchangeError("Import payload must be a JSON object") from exc
