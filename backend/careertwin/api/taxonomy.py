"""Multilingual occupational taxonomy endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Query
from sqlalchemy import func, select

from careertwin.api.dependencies import Config, CurrentUser, Db
from careertwin.models import (
    TaxonomyConcept,
    TaxonomyEmbedding,
    TaxonomyImport,
    TaxonomyRelation,
)
from careertwin.services.taxonomy import ESCO_RELEASE, search_concepts

router = APIRouter(prefix="/api/taxonomy", tags=["taxonomy"])


@router.get("/search")
def search_taxonomy(
    _: CurrentUser,
    db: Db,
    settings: Config,
    q: str = Query(min_length=2, max_length=100),
    language: str = Query(default="en", pattern="^(en|es)$"),
    concept_type: str | None = Query(default=None, pattern="^(skill|occupation)$"),
    mode: str = Query(default="hybrid", pattern="^(lexical|lexical_graph|hybrid)$"),
) -> list[dict[str, object]]:
    """Search the pinned local taxonomy; requests never leak profile text to ESCO services."""
    return search_concepts(db, q, language, concept_type, settings=settings, mode=mode)


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
    relation_count = db.scalar(
        select(func.count(TaxonomyRelation.id)).where(
            TaxonomyRelation.taxonomy == "ESCO", TaxonomyRelation.release == ESCO_RELEASE
        )
    )
    embedding_count = db.scalar(
        select(func.count(TaxonomyEmbedding.id)).where(
            TaxonomyEmbedding.taxonomy == "ESCO", TaxonomyEmbedding.release == ESCO_RELEASE
        )
    )
    onet_rows = db.execute(
        select(TaxonomyConcept.release, func.count(TaxonomyConcept.id))
        .where(TaxonomyConcept.taxonomy == "O*NET")
        .group_by(TaxonomyConcept.release)
    ).all()
    onet_counts: dict[str, int] = {}
    for release, count in onet_rows:
        onet_counts[release] = count
    imports = list(
        db.scalars(
            select(TaxonomyImport).order_by(
                TaxonomyImport.taxonomy, TaxonomyImport.release, TaxonomyImport.language
            )
        ).all()
    )
    return {
        "taxonomy": "ESCO",
        "release": ESCO_RELEASE,
        "counts": counts,
        "relations": relation_count or 0,
        "embeddings": embedding_count or 0,
        "enrichments": {
            "O*NET": onet_counts,
        },
        "imports": [
            {
                "taxonomy": item.taxonomy,
                "release": item.release,
                "language": item.language,
                "source_url": item.source_url,
                "archive_sha256": item.archive_sha256,
                "concept_count": item.concept_count,
                "relation_count": item.relation_count,
                "imported_at": item.imported_at,
            }
            for item in imports
        ],
    }
