"""Multilingual occupational taxonomy endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Query
from sqlalchemy import func, select

from careertwin.api.dependencies import CurrentUser, Db
from careertwin.models import TaxonomyConcept
from careertwin.services.taxonomy import ESCO_RELEASE, search_concepts

router = APIRouter(prefix="/api/taxonomy", tags=["taxonomy"])


@router.get("/search")
def search_taxonomy(
    _: CurrentUser,
    db: Db,
    q: str = Query(min_length=2, max_length=100),
    language: str = Query(default="en", pattern="^(en|es)$"),
    concept_type: str | None = Query(default=None, pattern="^(skill|occupation)$"),
) -> list[dict[str, object]]:
    """Search the pinned local taxonomy; requests never leak profile text to ESCO services."""
    return search_concepts(db, q, language, concept_type)


@router.get("/status")
def taxonomy_status(_: CurrentUser, db: Db) -> dict[str, object]:
    """Report the exact local release and concept counts."""
    rows = db.execute(
        select(TaxonomyConcept.language, func.count(TaxonomyConcept.id))
        .where(TaxonomyConcept.release == ESCO_RELEASE)
        .group_by(TaxonomyConcept.language)
    ).all()
    counts: dict[str, int] = {}
    for language, count in rows:
        counts[language] = count
    return {
        "taxonomy": "ESCO",
        "release": ESCO_RELEASE,
        "counts": counts,
    }
