"""Deterministic matching, comparisons and improvement recommendation endpoints."""

from __future__ import annotations

from typing import TypedDict

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.orm import selectinload

from careertwin.api.dependencies import CsrfUser, CurrentUser, Db
from careertwin.models import (
    CareerTask,
    ClaimState,
    Education,
    EvidenceClaim,
    Experience,
    MatchRun,
    Opportunity,
    ProfessionalProfile,
    Recommendation,
    Skill,
    TargetSet,
)
from careertwin.schemas import MatchRead, RecommendationRead, RecommendationUpdate, TaskRead
from careertwin.services.audit import record_audit
from careertwin.services.matching import POLICY_VERSION, calculate_match
from careertwin.services.recommendations import build_recommendations

router = APIRouter(prefix="/api/matches", tags=["matching and improvement"])


class RecommendationMatrixRow(TypedDict):
    """One repeated action aggregated across a named target set."""

    kind: str
    title: str
    opportunity_ids: list[str]
    requirement_ids: list[str]
    max_priority: float
    minimum_effort: float


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


def _target_set(db: Db, workspace_id: str, target_set_id: str) -> TargetSet:
    item = db.scalar(
        select(TargetSet).where(
            TargetSet.id == target_set_id, TargetSet.workspace_id == workspace_id
        )
    )
    if not item:
        raise HTTPException(status_code=404, detail="Target set not found")
    return item


@router.get("/target-sets/{target_set_id}/alignment")
def target_set_alignment(target_set_id: str, user: CurrentUser, db: Db) -> dict[str, object]:
    """Compute a named portfolio scenario from only its latest immutable match runs."""
    target = _target_set(db, user.workspace.id, target_set_id)
    runs: list[MatchRun] = []
    for opportunity_id in target.opportunity_ids:
        run = db.scalar(
            select(MatchRun)
            .where(
                MatchRun.workspace_id == user.workspace.id,
                MatchRun.opportunity_id == opportunity_id,
            )
            .order_by(MatchRun.created_at.desc())
        )
        if run:
            runs.append(run)
    weights = target.strategy.get("weights", {})
    weighted = [(run, max(0.0, float(weights.get(run.opportunity_id, 1.0)))) for run in runs]
    known = [(run, weight) for run, weight in weighted if run.score is not None and weight > 0]
    score_weight = sum(run.coverage * weight for run, weight in known)
    score = (
        sum((run.score or 0) * run.coverage * weight for run, weight in known) / score_weight
        if score_weight
        else None
    )
    total_weight = sum(weight for _, weight in weighted)
    coverage = (
        sum(run.coverage * weight for run, weight in weighted) / total_weight if total_weight else 0
    )
    return {
        "target_set_id": target.id,
        "name": target.name,
        "score": round(score, 4) if score is not None else None,
        "coverage": round(coverage, 4),
        "opportunity_count": len(target.opportunity_ids),
        "matched_count": len(runs),
        "strategy": target.strategy,
        "meaning": "Scenario-weighted evidence alignment, not hiring probability.",
        "runs": [MatchRead.model_validate(run).model_dump(mode="json") for run in runs],
    }


@router.get("/target-sets/{target_set_id}/recommendations")
def target_set_recommendation_matrix(
    target_set_id: str, user: CurrentUser, db: Db
) -> dict[str, object]:
    """Aggregate explicit gap actions across a named opportunity portfolio."""
    target = _target_set(db, user.workspace.id, target_set_id)
    items = (
        list(
            db.scalars(
                select(Recommendation).where(
                    Recommendation.workspace_id == user.workspace.id,
                    Recommendation.opportunity_id.in_(target.opportunity_ids),
                )
            ).all()
        )
        if target.opportunity_ids
        else []
    )
    grouped: dict[str, RecommendationMatrixRow] = {}
    for item in items:
        key = f"{item.kind}:{item.title.casefold()}"
        row = grouped.setdefault(
            key,
            {
                "kind": item.kind,
                "title": item.title,
                "opportunity_ids": [],
                "requirement_ids": [],
                "max_priority": 0.0,
                "minimum_effort": 1.0,
            },
        )
        opportunity_ids = row["opportunity_ids"]
        requirement_ids = row["requirement_ids"]
        if item.opportunity_id and item.opportunity_id not in opportunity_ids:
            opportunity_ids.append(item.opportunity_id)
        for requirement_id in item.requirement_ids:
            if requirement_id not in requirement_ids:
                requirement_ids.append(requirement_id)
        row["max_priority"] = max(row["max_priority"], item.priority)
        row["minimum_effort"] = min(row["minimum_effort"], item.effort)
    rows = sorted(
        grouped.values(),
        key=lambda row: (-len(row["opportunity_ids"]), -row["max_priority"], row["title"]),
    )
    return {
        "target_set_id": target.id,
        "denominator": len(target.opportunity_ids),
        "actions": rows,
        "meaning": "Repeated gaps across this saved target set; expected lift is a scenario, not a promise.",
    }


@router.patch("/recommendations/{recommendation_id}", response_model=RecommendationRead)
def update_recommendation(
    recommendation_id: str, payload: RecommendationUpdate, user: CsrfUser, db: Db
) -> RecommendationRead:
    """Turn a suggested gap into an editable action plan with explicit progress."""
    item = db.scalar(
        select(Recommendation).where(
            Recommendation.id == recommendation_id,
            Recommendation.workspace_id == user.workspace.id,
        )
    )
    if not item:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(item, field, value)
    if item.progress >= 1:
        item.status = "completed"
    item.priority = round(item.impact * (1.2 - item.effort), 4)
    record_audit(db, user, "recommendation.updated", "recommendation", item.id)
    return RecommendationRead.model_validate(item)


@router.post("/recommendations/{recommendation_id}/task", response_model=TaskRead)
def recommendation_task(recommendation_id: str, user: CsrfUser, db: Db) -> TaskRead:
    """Create a candidate-owned next action linked to an explicit readiness recommendation."""
    item = db.scalar(
        select(Recommendation).where(
            Recommendation.id == recommendation_id,
            Recommendation.workspace_id == user.workspace.id,
        )
    )
    if not item:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    task = CareerTask(
        workspace_id=user.workspace.id,
        kind="task",
        title=item.title,
        notes=f"CareerTwin readiness action. Recommendation {item.id}. {item.rationale}",
    )
    db.add(task)
    item.status = "planned"
    db.flush()
    record_audit(db, user, "recommendation.task_created", "career_task", task.id)
    return TaskRead.model_validate(task)


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
