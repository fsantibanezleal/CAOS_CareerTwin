"""Pinned ESCO concept ingestion and deterministic multilingual search."""

from __future__ import annotations

import csv
import io
import zipfile
from collections.abc import Iterator
from pathlib import Path

from sqlalchemy import delete, func, or_, select
from sqlalchemy.orm import Session

from careertwin.models import TaxonomyConcept
from careertwin.services.normalization import label_similarity

ESCO_RELEASE = "1.2.1"


def iter_esco_csv(archive_path: Path, language: str) -> Iterator[dict[str, str]]:
    """Yield skill and occupation concepts from an official ESCO CSV archive."""
    with zipfile.ZipFile(archive_path) as archive:
        candidates = [
            name
            for name in archive.namelist()
            if name.casefold().endswith(".csv")
            and any(marker in name.casefold() for marker in ("skill", "occupation"))
        ]
        for name in candidates:
            concept_type = "skill" if "skill" in name.casefold() else "occupation"
            with archive.open(name) as raw:
                text = io.TextIOWrapper(raw, encoding="utf-8-sig", errors="replace")
                for row in csv.DictReader(text):
                    uri = row.get("conceptUri") or row.get("conceptURI") or row.get("uri")
                    label = row.get("preferredLabel") or row.get("preferred label")
                    if uri and label:
                        yield {
                            "uri": uri,
                            "concept_type": concept_type,
                            "language": language,
                            "preferred_label": label,
                            "alternative_labels": row.get("altLabels") or "",
                            "description": row.get("description") or "",
                        }


def import_esco(db: Session, archive_path: Path, language: str, replace: bool = False) -> int:
    """Import a pinned local ESCO archive without downloading or changing release at runtime."""
    if replace:
        db.execute(
            delete(TaxonomyConcept).where(
                TaxonomyConcept.taxonomy == "ESCO",
                TaxonomyConcept.release == ESCO_RELEASE,
                TaxonomyConcept.language == language,
            )
        )
    count = 0
    for row in iter_esco_csv(archive_path, language):
        alternatives = [
            value.strip() for value in row["alternative_labels"].split("\n") if value.strip()
        ]
        db.add(
            TaxonomyConcept(
                taxonomy="ESCO",
                release=ESCO_RELEASE,
                uri=row["uri"],
                concept_type=row["concept_type"],
                language=row["language"],
                preferred_label=row["preferred_label"],
                alternative_labels=alternatives,
                description=row["description"],
            )
        )
        count += 1
        if count % 1_000 == 0:
            db.flush()
    return count


def search_concepts(
    db: Session, query: str, language: str, concept_type: str | None, limit: int = 20
) -> list[dict[str, object]]:
    """Search pinned concepts and rerank the bounded SQL result deterministically."""
    pattern = f"%{query.strip()}%"
    statement = select(TaxonomyConcept).where(
        TaxonomyConcept.release == ESCO_RELEASE,
        TaxonomyConcept.language == language,
        or_(
            func.lower(TaxonomyConcept.preferred_label).like(pattern.casefold()),
            func.lower(TaxonomyConcept.description).like(pattern.casefold()),
        ),
    )
    if concept_type:
        statement = statement.where(TaxonomyConcept.concept_type == concept_type)
    candidates = list(db.scalars(statement.limit(max(100, limit * 5))).all())
    candidates.sort(key=lambda item: label_similarity(query, item.preferred_label), reverse=True)
    return [
        {
            "uri": item.uri,
            "taxonomy": item.taxonomy,
            "release": item.release,
            "concept_type": item.concept_type,
            "language": item.language,
            "preferred_label": item.preferred_label,
            "alternative_labels": item.alternative_labels,
            "description": item.description,
            "similarity": round(label_similarity(query, item.preferred_label), 4),
        }
        for item in candidates[:limit]
    ]
