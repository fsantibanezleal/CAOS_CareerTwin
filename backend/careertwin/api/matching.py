"""Deterministic matching, comparisons and improvement recommendation endpoints."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.orm import selectinload

from careertwin.api.dependencies import CsrfUser, CurrentUser, Db
from careertwin.models import (
    ClaimState,
    Education,
    EvidenceClaim,
    Experience,
    MatchRun,
    Opportunity,
    ProfessionalProfile,
    Recommendation,
    Skill,
)
from careertwin.schemas import MatchRead, RecommendationRead
from careertwin.services.audit import record_audit
from careertwin.services.matching import POLICY_VERSION, calculate_match
from careertwin.services.recommendations import build_recommendations

router = APIRouter(prefix="/api/matches", tags=["matching and improvement"])


def _inputs(
    db: Db, workspace_id: str, opportunity_id: str
) -> tuple[
    ProfessionalProfile,
    list[Skill],
    list[Experience],
    list[Education],
    list[EvidenceClaim],
    Opportunity,
]:
    profile = db.scalar(
        select(ProfessionalProfile).where(ProfessionalProfile.workspace_id == workspace_id)
    )
    opportunity = db.scalar(
        select(Opportunity)
        .options(selectinload(Opportunity.requirements))
        .where(Opportunity.id == opportunity_id, Opportunity.workspace_id == workspace_id)
    )
    if not profile or not opportunity:
        raise HTTPException(status_code=404, detail="Opportunity or profile not found")
    skills = list(
        db.scalars(
            select(Skill)
            .options(selectinload(Skill.evidence))
            .where(Skill.workspace_id == workspace_id)
        ).all()
    )
    experiences = list(
        db.scalars(select(Experience).where(Experience.workspace_id == workspace_id)).all()
    )
    education = list(
        db.scalars(select(Education).where(Education.workspace_id == workspace_id)).all()
    )
    claims = list(
        db.scalars(
            select(EvidenceClaim).where(
                EvidenceClaim.workspace_id == workspace_id,
                EvidenceClaim.state == ClaimState.CONFIRMED,
            )
        ).all()
    )
    return profile, skills, experiences, education, claims, opportunity


@router.post("/{opportunity_id}/run", response_model=MatchRead, status_code=status.HTTP_201_CREATED)
def run_match(opportunity_id: str, user: CsrfUser, db: Db) -> MatchRead:
    """Persist an immutable, byte-stable match run for the current canonical input revision."""
    calculation = calculate_match(*_inputs(db, user.workspace.id, opportunity_id))
    existing = db.scalar(
        select(MatchRun).where(
            MatchRun.workspace_id == user.workspace.id,
            MatchRun.opportunity_id == opportunity_id,
            MatchRun.policy_version == POLICY_VERSION,
            MatchRun.input_digest == calculation.input_digest,
        )
    )
    if existing:
        return MatchRead.model_validate(existing)
    run = MatchRun(
        workspace_id=user.workspace.id,
        opportunity_id=opportunity_id,
        policy_version=POLICY_VERSION,
        **calculation.__dict__,
    )
    db.add(run)
    db.flush()
    record_audit(
        db,
        user,
        "match.calculated",
        "match_run",
        run.id,
        {"policy": POLICY_VERSION, "coverage": run.coverage, "eligibility": run.eligibility},
    )
    return MatchRead.model_validate(run)


@router.get("", response_model=list[MatchRead])
def list_matches(user: CurrentUser, db: Db) -> list[MatchRead]:
    """List immutable runs for this workspace, newest first."""
    runs = db.scalars(
        select(MatchRun)
        .where(MatchRun.workspace_id == user.workspace.id)
        .order_by(MatchRun.created_at.desc())
    ).all()
    return [MatchRead.model_validate(run) for run in runs]


@router.get("/{opportunity_id}/latest", response_model=MatchRead)
def latest_match(opportunity_id: str, user: CurrentUser, db: Db) -> MatchRead:
    """Return the latest run for a tenant-owned opportunity."""
    run = db.scalar(
        select(MatchRun)
        .where(
            MatchRun.workspace_id == user.workspace.id,
            MatchRun.opportunity_id == opportunity_id,
        )
        .order_by(MatchRun.created_at.desc())
    )
    if not run:
        raise HTTPException(status_code=404, detail="No match run exists")
    return MatchRead.model_validate(run)


@router.post("/{opportunity_id}/recommendations", response_model=list[RecommendationRead])
def regenerate_recommendations(
    opportunity_id: str, user: CsrfUser, db: Db
) -> list[RecommendationRead]:
    """Regenerate transparent actions from the latest deterministic gap assessment."""
    run = db.scalar(
        select(MatchRun)
        .where(
            MatchRun.workspace_id == user.workspace.id,
            MatchRun.opportunity_id == opportunity_id,
        )
        .order_by(MatchRun.created_at.desc())
    )
    if not run:
        raise HTTPException(
            status_code=409, detail="Run matching before generating recommendations"
        )
    db.execute(
        delete(Recommendation).where(
            Recommendation.workspace_id == user.workspace.id,
            Recommendation.opportunity_id == opportunity_id,
            Recommendation.status == "suggested",
        )
    )
    items = [
        Recommendation(workspace_id=user.workspace.id, opportunity_id=opportunity_id, **value)
        for value in build_recommendations(run.assessments)
    ]
    db.add_all(items)
    db.flush()
    record_audit(
        db,
        user,
        "recommendations.regenerated",
        "opportunity",
        opportunity_id,
        {"count": len(items)},
    )
    return [RecommendationRead.model_validate(item) for item in items]


@router.get("/recommendations/all", response_model=list[RecommendationRead])
def list_recommendations(user: CurrentUser, db: Db) -> list[RecommendationRead]:
    """List improvement actions across the user's saved opportunity set."""
    items = db.scalars(
        select(Recommendation)
        .where(Recommendation.workspace_id == user.workspace.id)
        .order_by(Recommendation.priority.desc(), Recommendation.created_at.desc())
    ).all()
    return [RecommendationRead.model_validate(item) for item in items]


@router.get("/portfolio/alignment")
def portfolio_alignment(user: CurrentUser, db: Db) -> dict[str, object]:
    """Aggregate only the latest run per opportunity and publish its evidence coverage."""
    latest_ids = (
        select(func.max(MatchRun.created_at).label("latest"), MatchRun.opportunity_id)
        .where(MatchRun.workspace_id == user.workspace.id)
        .group_by(MatchRun.opportunity_id)
        .subquery()
    )
    runs = db.scalars(
        select(MatchRun).join(
            latest_ids,
            (MatchRun.opportunity_id == latest_ids.c.opportunity_id)
            & (MatchRun.created_at == latest_ids.c.latest),
        )
    ).all()
    known = [run for run in runs if run.score is not None]
    total_coverage = sum(run.coverage for run in runs)
    score = (
        sum((run.score or 0) * run.coverage for run in known) / sum(run.coverage for run in known)
        if known and sum(run.coverage for run in known)
        else None
    )
    return {
        "score": round(score, 4) if score is not None else None,
        "coverage": round(total_coverage / len(runs), 4) if runs else 0,
        "opportunity_count": len(runs),
        "known_score_count": len(known),
        "meaning": "Weighted evidence alignment across saved opportunities, not hiring probability.",
        "runs": [MatchRead.model_validate(run).model_dump(mode="json") for run in runs],
    }
