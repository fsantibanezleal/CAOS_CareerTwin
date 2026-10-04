"""Authenticated public job search and explicit tenant-owned snapshot import."""

from __future__ import annotations

import hashlib
import uuid
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from sqlalchemy import select

from careertwin.api.dependencies import Config, CsrfUser, CurrentUser, Db
from careertwin.api.opportunities import _save_snapshot
from careertwin.models import Opportunity, ProfessionalProfile
from careertwin.schemas import OpportunityRead
from careertwin.services.audit import record_audit
from careertwin.services.job_discovery import (
    DiscoveryError,
    SearchPage,
    SearchRequest,
    cache,
    issue_ticket,
    resolve_ticket,
)

router = APIRouter(prefix="/api/job-search", tags=["job discovery"])


class ImportRequest(BaseModel):
    """No client-controlled URL, body or arbitrary canonical fields are accepted."""

    model_config = ConfigDict(extra="forbid")
    ticket: str = Field(min_length=1, max_length=1024)


class SavedSearch(BaseModel):
    """A private named query, never an automatically executed alert or profile export."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    name: str = Field(min_length=1, max_length=80)
    search: SearchRequest


class SavedSearchRead(SavedSearch):
    """Validated persisted query; general profile preferences are otherwise free-form."""

    id: uuid.UUID


def _presets(profile: ProfessionalProfile) -> list[dict[str, Any]]:
    """Ignore malformed user-edited metadata without breaking the discovery interface."""
    raw = profile.preferences.get("job_search_presets", [])
    if not isinstance(raw, list):
        return []
    items = []
    for entry in raw[:12]:
        try:
            item = SavedSearchRead.model_validate(entry)
            if item.search.page == 1 and not item.search.cursor:
                items.append(item.model_dump(mode="json"))
        except ValidationError:
            continue
    return items


def _profile(user: CurrentUser, db: Db, *, lock: bool = False) -> ProfessionalProfile:
    query = select(ProfessionalProfile).where(ProfessionalProfile.workspace_id == user.workspace.id)
    if lock:
        query = query.with_for_update()
    profile = db.scalar(query)
    if profile is None:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile


@router.get("/presets")
def list_presets(user: CurrentUser, db: Db) -> list[dict[str, Any]]:
    """Read only this seeker's named searches; nothing is submitted to providers."""
    return _presets(_profile(user, db))


@router.post("/presets", status_code=201)
def save_preset(payload: SavedSearch, user: CsrfUser, db: Db) -> dict[str, Any]:
    """Persist an explicitly named first-page search without enabling background polling."""
    if payload.search.cursor or payload.search.page != 1:
        raise HTTPException(
            status_code=422, detail="Save the first page of a search, not a continuation"
        )
    profile = _profile(user, db, lock=True)
    presets = _presets(profile)
    if len(presets) >= 12:
        raise HTTPException(
            status_code=409, detail="Remove a saved search before adding another (maximum 12)"
        )
    item = {"id": str(uuid.uuid4()), **payload.model_dump(mode="json")}
    presets.append(item)
    profile.preferences = {**profile.preferences, "job_search_presets": presets}
    profile.revision += 1
    record_audit(db, user, "job_search.preset_saved", "professional_profile", profile.id)
    return item


@router.delete("/presets/{preset_id}", status_code=204)
def delete_preset(preset_id: str, user: CsrfUser, db: Db) -> None:
    """Remove a tenant-owned query without deleting saved jobs or changing other preferences."""
    profile = _profile(user, db, lock=True)
    presets = _presets(profile)
    filtered = [item for item in presets if item.get("id") != preset_id]
    if len(filtered) == len(presets):
        raise HTTPException(status_code=404, detail="Saved search not found")
    profile.preferences = {**profile.preferences, "job_search_presets": filtered}
    profile.revision += 1
    record_audit(db, user, "job_search.preset_deleted", "professional_profile", profile.id)


@router.get("/catalog")
def catalog(user: CurrentUser) -> dict[str, Any]:
    """Expose source capabilities and cached live Jobicy location taxonomy."""
    try:
        locations = cache.jobicy_locations()
        error = None
    except DiscoveryError as exc:
        locations, error = [], str(exc)
    return {
        "providers": [
            {"id": "himalayas", "name": "Himalayas", "docs_url": "https://himalayas.app/api"},
            {"id": "jobicy", "name": "Jobicy", "docs_url": "https://jobicy.com/jobs-rss-feed"},
        ],
        "jobicy_locations": locations,
        "jobicy_locations_error": error,
    }


@router.post("", response_model=SearchPage)
def search(payload: SearchRequest, user: CsrfUser, db: Db, settings: Config) -> SearchPage:
    """Search only on explicit request, without exporting profiles or implicitly saving jobs."""
    try:
        if payload.provider == "jobicy" and payload.geo:
            if payload.geo not in {item["value"] for item in cache.jobicy_locations()}:
                raise DiscoveryError("Unsupported job source location.", 422)
        key, page = cache.search(payload)
    except DiscoveryError as exc:
        raise HTTPException(status_code=exc.status, detail=str(exc)) from exc
    saved = {
        item.source_url: item.id
        for item in db.scalars(
            select(Opportunity).where(
                Opportunity.workspace_id == user.workspace.id,
                Opportunity.source_url.in_([job.source_url for job in page.jobs]),
            )
        )
    }
    secret = settings.app_secret_key.get_secret_value()
    for job in page.jobs:
        job.import_ticket = issue_ticket(user.workspace.id, key, job.key, secret)
        job.saved_opportunity_id = saved.get(job.source_url)
    return page


@router.post("/import")
def import_preview(
    payload: ImportRequest, user: CsrfUser, db: Db, settings: Config
) -> dict[str, Any]:
    """Save an explicitly approved source snapshot, leaving requirements for human review."""
    try:
        job = resolve_ticket(
            payload.ticket, user.workspace.id, settings.app_secret_key.get_secret_value()
        )
    except DiscoveryError as exc:
        raise HTTPException(status_code=exc.status, detail=str(exc)) from exc
    # Serialize same-workspace imports on PostgreSQL under the already established RLS context.
    db.refresh(user.workspace, with_for_update=True)
    existing = db.scalar(
        select(Opportunity).where(
            Opportunity.workspace_id == user.workspace.id,
            Opportunity.source_url == job.source_url,
        )
    )
    if existing:
        return {"created": False, "opportunity": OpportunityRead.model_validate(existing)}
    item = Opportunity(
        workspace_id=user.workspace.id,
        title=job.title,
        employer=job.employer,
        description=job.description,
        source_url=job.source_url,
        source_kind="url",
        source_sha256=hashlib.sha256(job.description.encode()).hexdigest(),
        location=", ".join(job.locations)[:240],
        seniority=", ".join(job.seniority)[:80],
        industry=", ".join(job.categories)[:160],
        remote_mode="remote",
        published_at=job.published_at,
        deadline_at=None,
        compensation={
            "currency": job.currency,
            "period": job.salary_period,
            "source_min": job.salary_min,
            "source_max": job.salary_max,
        },
        structured_data={
            "capture_status": "ready",
            "discovery": {
                "provider": job.provider,
                "provider_id": job.provider_id,
                "source_url": job.source_url,
                "retrieved_at": job.retrieved_at.isoformat(),
                "source_expires_at": job.expires_at.isoformat() if job.expires_at else None,
                "locations": job.locations,
                "timezones": job.timezones,
                "employment_type": job.employment_type,
                "review_status": "needs_review",
            },
        },
    )
    db.add(item)
    db.flush()
    _save_snapshot(db, item)
    record_audit(
        db,
        user,
        "opportunity.discovery_saved",
        "opportunity",
        item.id,
        {"provider": job.provider, "requirements_reviewed": False},
    )
    db.flush()
    return {"created": True, "opportunity": OpportunityRead.model_validate(item)}
