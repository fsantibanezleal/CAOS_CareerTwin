"""Pinned ESCO concept ingestion and deterministic multilingual search."""

from __future__ import annotations

import csv
import hashlib
import io
import zipfile
from collections import defaultdict
from collections.abc import Iterator
from pathlib import Path
from typing import Any

from sqlalchemy import delete, func, or_, select
from sqlalchemy.orm import Session

from careertwin.config import Settings
from careertwin.models import TaxonomyConcept, TaxonomyImport, TaxonomyRelation
from careertwin.services.normalization import label_similarity

ESCO_RELEASE = "1.2.1"
ONET_RELEASE = "30.3"
ESCO_SOURCE_URL = "https://esco.ec.europa.eu/en/use-esco/download"
ONET_SOURCE_URL = "https://www.onetcenter.org/dl_files/database/db_30_3_text.zip"


def record_taxonomy_import(
    db: Session,
    archive_path: Path,
    *,
    taxonomy: str,
    release: str,
    language: str,
    source_url: str,
    concept_count: int,
    relation_count: int,
) -> TaxonomyImport:
    """Persist non-secret archive provenance so every local taxonomy snapshot is auditable."""
    with archive_path.open("rb") as stream:
        digest = hashlib.file_digest(stream, "sha256").hexdigest()
    existing = db.scalar(
        select(TaxonomyImport).where(
            TaxonomyImport.taxonomy == taxonomy,
            TaxonomyImport.release == release,
            TaxonomyImport.language == language,
            TaxonomyImport.archive_sha256 == digest,
        )
    )
    if existing:
        existing.source_url = source_url
        existing.concept_count = max(existing.concept_count, concept_count)
        existing.relation_count = max(existing.relation_count, relation_count)
        return existing
    item = TaxonomyImport(
        taxonomy=taxonomy,
        release=release,
        language=language,
        source_url=source_url,
        archive_sha256=digest,
        concept_count=concept_count,
        relation_count=relation_count,
    )
    db.add(item)
    return item


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
    existing = set(
        db.scalars(
            select(TaxonomyConcept.uri).where(
                TaxonomyConcept.taxonomy == "ESCO",
                TaxonomyConcept.release == ESCO_RELEASE,
                TaxonomyConcept.language == language,
            )
        ).all()
    )
    count = 0
    for row in iter_esco_csv(archive_path, language):
        if row["uri"] in existing:
            continue
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
        existing.add(row["uri"])
        if count % 1_000 == 0:
            db.flush()
    return count


def _row_value(row: dict[str, str], *names: str) -> str:
    normalized = {key.casefold().replace(" ", ""): value for key, value in row.items()}
    for name in names:
        value = normalized.get(name.casefold().replace(" ", ""), "").strip()
        if value:
            return value
    return ""


def iter_esco_relations(archive_path: Path) -> Iterator[dict[str, Any]]:
    """Yield broader and occupation-skill edges from an official ESCO bundle."""
    with zipfile.ZipFile(archive_path) as archive:
        for name in archive.namelist():
            lowered = name.casefold()
            if not lowered.endswith(".csv") or not any(
                marker in lowered
                for marker in (
                    "broaderrelationsskillpillar",
                    "broaderrelationsoccpillar",
                    "occupationskillrelations",
                )
            ):
                continue
            with archive.open(name) as raw:
                text = io.TextIOWrapper(raw, encoding="utf-8-sig", errors="replace")
                for row in csv.DictReader(text):
                    if "occupationskillrelations" in lowered:
                        source = _row_value(row, "occupationUri", "occupationConceptUri")
                        target = _row_value(row, "skillUri", "skillConceptUri")
                        relation = _row_value(row, "relationType") or "associated_skill"
                    else:
                        source = _row_value(row, "conceptUri", "narrowerConceptUri", "narrowerUri")
                        target = _row_value(row, "broaderUri", "broaderConceptUri")
                        relation = "broader"
                    if source and target:
                        yield {
                            "source_uri": source,
                            "target_uri": target,
                            "relation": relation[:80],
                            "provenance": {"file": Path(name).name},
                        }


def import_esco_relations(db: Session, archive_path: Path, replace: bool = False) -> int:
    """Import ESCO graph edges once per pinned release with file-level provenance."""
    if replace:
        db.execute(
            delete(TaxonomyRelation).where(
                TaxonomyRelation.taxonomy == "ESCO",
                TaxonomyRelation.release == ESCO_RELEASE,
            )
        )
    existing: set[tuple[str, str, str]] = {
        (source_uri, target_uri, relation)
        for source_uri, target_uri, relation in db.execute(
            select(
                TaxonomyRelation.source_uri,
                TaxonomyRelation.target_uri,
                TaxonomyRelation.relation,
            ).where(
                TaxonomyRelation.taxonomy == "ESCO",
                TaxonomyRelation.release == ESCO_RELEASE,
            )
        ).all()
    }
    count = 0
    for row in iter_esco_relations(archive_path):
        key = (row["source_uri"], row["target_uri"], row["relation"])
        if key in existing:
            continue
        db.add(
            TaxonomyRelation(
                taxonomy="ESCO",
                release=ESCO_RELEASE,
                source_uri=row["source_uri"],
                target_uri=row["target_uri"],
                relation=row["relation"],
                provenance=row["provenance"],
            )
        )
        existing.add(key)
        count += 1
        if count % 5_000 == 0:
            db.flush()
    db.flush()
    return count


def _archive_rows(archive_path: Path, filename_marker: str) -> Iterator[dict[str, str]]:
    with zipfile.ZipFile(archive_path) as archive:
        candidate = next(
            (
                name
                for name in archive.namelist()
                if filename_marker in Path(name).stem.casefold()
                and Path(name).suffix.casefold() in {".txt", ".csv"}
            ),
            None,
        )
        if not candidate:
            raise ValueError(f"O*NET archive is missing {filename_marker}")
        with archive.open(candidate) as raw:
            text = io.TextIOWrapper(raw, encoding="utf-8-sig", errors="replace")
            delimiter = "\t" if Path(candidate).suffix.casefold() == ".txt" else ","
            yield from csv.DictReader(text, delimiter=delimiter)


def import_onet(
    db: Session,
    archive_path: Path,
    release: str = ONET_RELEASE,
    replace: bool = False,
) -> dict[str, int]:
    """Import the official US-specific O*NET occupation/skill enrichment snapshot."""
    if replace:
        db.execute(
            delete(TaxonomyRelation).where(
                TaxonomyRelation.taxonomy == "O*NET", TaxonomyRelation.release == release
            )
        )
        db.execute(
            delete(TaxonomyConcept).where(
                TaxonomyConcept.taxonomy == "O*NET", TaxonomyConcept.release == release
            )
        )
    occupations: dict[str, dict[str, str]] = {}
    for row in _archive_rows(archive_path, "occupation data"):
        code = _row_value(row, "O*NET-SOC Code", "ONET_SOC_CODE")
        title = _row_value(row, "Title")
        if code and title:
            occupations[code] = {
                "title": title,
                "description": _row_value(row, "Description"),
            }
    skills: dict[str, str] = {}
    relations: dict[tuple[str, str], dict[str, Any]] = {}
    for row in _archive_rows(archive_path, "skills"):
        code = _row_value(row, "O*NET-SOC Code", "ONET_SOC_CODE")
        element_id = _row_value(row, "Element ID")
        name = _row_value(row, "Element Name")
        scale = _row_value(row, "Scale ID")
        if not code or not element_id or not name:
            continue
        skills[element_id] = name
        if scale in {"IM", "Importance", ""}:
            relations[(code, element_id)] = {
                "scale": scale or "unspecified",
                "value": _row_value(row, "Data Value"),
            }
    existing_uris = set(
        db.scalars(
            select(TaxonomyConcept.uri).where(
                TaxonomyConcept.taxonomy == "O*NET",
                TaxonomyConcept.release == release,
                TaxonomyConcept.language == "en",
            )
        ).all()
    )
    concept_count = 0
    for code, item in occupations.items():
        uri = f"https://www.onetonline.org/link/summary/{code}"
        if uri not in existing_uris:
            db.add(
                TaxonomyConcept(
                    taxonomy="O*NET",
                    release=release,
                    uri=uri,
                    concept_type="occupation",
                    language="en",
                    preferred_label=item["title"],
                    alternative_labels=[],
                    description=item["description"],
                )
            )
            existing_uris.add(uri)
            concept_count += 1
    for element_id, name in skills.items():
        uri = f"urn:onet:element:{element_id}"
        if uri not in existing_uris:
            db.add(
                TaxonomyConcept(
                    taxonomy="O*NET",
                    release=release,
                    uri=uri,
                    concept_type="skill",
                    language="en",
                    preferred_label=name,
                    alternative_labels=[],
                    description="US O*NET worker skill element.",
                )
            )
            existing_uris.add(uri)
            concept_count += 1
    existing_relations: set[tuple[str, str]] = {
        (source_uri, target_uri)
        for source_uri, target_uri in db.execute(
            select(TaxonomyRelation.source_uri, TaxonomyRelation.target_uri).where(
                TaxonomyRelation.taxonomy == "O*NET", TaxonomyRelation.release == release
            )
        ).all()
    }
    relation_count = 0
    for (code, element_id), provenance in relations.items():
        source_uri = f"https://www.onetonline.org/link/summary/{code}"
        target_uri = f"urn:onet:element:{element_id}"
        if (source_uri, target_uri) in existing_relations:
            continue
        db.add(
            TaxonomyRelation(
                taxonomy="O*NET",
                release=release,
                source_uri=source_uri,
                target_uri=target_uri,
                relation="requires_skill",
                provenance=provenance,
            )
        )
        existing_relations.add((source_uri, target_uri))
        relation_count += 1
    db.flush()
    return {"concepts": concept_count, "relations": relation_count}


def search_concepts(
    db: Session,
    query: str,
    language: str,
    concept_type: str | None,
    limit: int = 20,
    settings: Settings | None = None,
    mode: str = "hybrid",
) -> list[dict[str, object]]:
    """Rank concepts deterministically by bilingual lexical similarity and graph degree.

    The ``hybrid`` name remains a wire-compatible alias for ``lexical_graph``. CareerTwin does not
    generate embeddings on the VPS; an external semantic adapter requires a separately benchmarked
    ADR before it may influence canonical taxonomy ranking.
    """
    del settings
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
    candidates = list(db.scalars(statement.limit(max(200, limit * 10))).all())
    uris = [item.uri for item in candidates]
    degree: defaultdict[str, int] = defaultdict(int)
    if uris:
        rows = db.execute(
            select(TaxonomyRelation.source_uri, TaxonomyRelation.target_uri).where(
                TaxonomyRelation.taxonomy == "ESCO",
                TaxonomyRelation.release == ESCO_RELEASE,
                or_(
                    TaxonomyRelation.source_uri.in_(uris),
                    TaxonomyRelation.target_uri.in_(uris),
                ),
            )
        ).all()
        for source_uri, target_uri in rows:
            degree[source_uri] += 1
            degree[target_uri] += 1
    ranked: list[tuple[float, TaxonomyConcept, dict[str, float]]] = []
    for item in candidates:
        lexical = max(
            [label_similarity(query, item.preferred_label)]
            + [label_similarity(query, label) for label in item.alternative_labels[:50]]
        )
        graph = min(1.0, degree[item.uri] / 20)
        if mode == "lexical":
            score = lexical
        else:
            score = 0.85 * lexical + 0.15 * graph
        ranked.append((score, item, {"lexical": lexical, "graph": graph}))
    ranked.sort(key=lambda row: (row[0], row[1].preferred_label), reverse=True)
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
            "similarity": round(score, 4),
            "retrieval": {key: round(value, 4) for key, value in components.items()},
        }
        for score, item, components in ranked[:limit]
    ]
