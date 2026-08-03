"""Deterministic graph and timeline projections for interactive profile visualization."""

from __future__ import annotations

from typing import Any

from careertwin.models import (
    Accomplishment,
    Education,
    EvidenceClaim,
    Experience,
    ProfessionalProfile,
    Skill,
    Source,
)
from careertwin.services.normalization import normalize_label


def build_profile_graph(
    profile: ProfessionalProfile,
    skills: list[Skill],
    experiences: list[Experience],
    education: list[Education],
    claims: list[EvidenceClaim],
    sources: list[Source] | None = None,
    accomplishments: list[Accomplishment] | None = None,
) -> dict[str, list[dict[str, Any]]]:
    """Project canonical rows into stable visualization nodes and evidence-bearing edges."""
    nodes: list[dict[str, Any]] = [
        {
            "id": f"profile:{profile.id}",
            "type": "profile",
            "label": profile.headline or "Professional profile",
            "strength": 1,
        }
    ]
    edges: list[dict[str, Any]] = []
    source_by_id = {item.id: item for item in sources or []}
    linked_claims: set[str] = set()
    skill_by_name = {normalize_label(item.name): item for item in skills}
    for skill in sorted(skills, key=lambda item: (-item.level, item.name.casefold())):
        node_id = f"skill:{skill.id}"
        nodes.append(
            {
                "id": node_id,
                "type": "skill",
                "label": skill.name,
                "strength": skill.level,
                "confidence": skill.confidence,
                "taxonomy_uri": skill.taxonomy_uri,
                "evidence_count": len(skill.evidence),
            }
        )
        edges.append(
            {
                "id": f"profile-skill:{skill.id}",
                "source": f"profile:{profile.id}",
                "target": node_id,
                "type": "has-capability",
                "weight": max(0.1, skill.confidence),
            }
        )
        for claim in skill.evidence:
            linked_claims.add(claim.id)
            claim_id = f"claim:{claim.id}"
            if not any(node["id"] == claim_id for node in nodes):
                nodes.append(
                    {
                        "id": claim_id,
                        "type": "evidence",
                        "label": claim.statement,
                        "strength": claim.confidence,
                        "source_id": claim.source_id,
                    }
                )
            edges.append(
                {
                    "id": f"skill-claim:{skill.id}:{claim.id}",
                    "source": node_id,
                    "target": claim_id,
                    "type": "supported-by",
                    "weight": claim.confidence,
                }
            )
    for claim in claims:
        claim_id = f"claim:{claim.id}"
        if not any(node["id"] == claim_id for node in nodes):
            nodes.append(
                {
                    "id": claim_id,
                    "type": "evidence",
                    "label": claim.statement,
                    "strength": claim.confidence,
                    "claim_type": claim.claim_type,
                    "source_id": claim.source_id,
                }
            )
        if claim.id not in linked_claims:
            edges.append(
                {
                    "id": f"profile-claim:{claim.id}",
                    "source": f"profile:{profile.id}",
                    "target": claim_id,
                    "type": "has-evidence",
                    "weight": max(0.1, claim.confidence),
                }
            )
        if claim.source_id:
            source = source_by_id.get(claim.source_id)
            source_node_id = f"source:{claim.source_id}"
            if not any(node["id"] == source_node_id for node in nodes):
                nodes.append(
                    {
                        "id": source_node_id,
                        "type": "source",
                        "label": source.label if source else "Evidence source",
                        "strength": 0.55,
                        "source_kind": source.kind if source else "unknown",
                    }
                )
            edges.append(
                {
                    "id": f"claim-source:{claim.id}:{claim.source_id}",
                    "source": claim_id,
                    "target": source_node_id,
                    "type": "derived-from",
                    "weight": 1,
                }
            )
    for experience in experiences:
        node_id = f"experience:{experience.id}"
        nodes.append(
            {
                "id": node_id,
                "type": "experience",
                "label": f"{experience.role} at {experience.organization}",
                "start": experience.start_date,
                "end": experience.end_date,
                "strength": 0.75,
            }
        )
        edges.append(
            {
                "id": f"profile-experience:{experience.id}",
                "source": f"profile:{profile.id}",
                "target": node_id,
                "type": "has-experience",
                "weight": 0.8,
            }
        )
        for skill_name in experience.skills:
            matched_skill = skill_by_name.get(normalize_label(skill_name))
            if matched_skill:
                edges.append(
                    {
                        "id": f"experience-skill:{experience.id}:{matched_skill.id}",
                        "source": node_id,
                        "target": f"skill:{matched_skill.id}",
                        "type": "demonstrates",
                        "weight": 0.65,
                    }
                )
    for education_item in education:
        node_id = f"education:{education_item.id}"
        nodes.append(
            {
                "id": node_id,
                "type": "education",
                "label": f"{education_item.credential}, {education_item.institution}",
                "start": education_item.start_date,
                "end": education_item.end_date,
                "strength": 0.65,
            }
        )
        edges.append(
            {
                "id": f"profile-education:{education_item.id}",
                "source": f"profile:{profile.id}",
                "target": node_id,
                "type": "has-education",
                "weight": 0.7,
            }
        )
    for accomplishment in accomplishments or []:
        node_id = f"accomplishment:{accomplishment.id}"
        nodes.append(
            {
                "id": node_id,
                "type": "accomplishment",
                "label": accomplishment.title,
                "strength": 0.85 if accomplishment.status == "confirmed" else 0.6,
                "result": accomplishment.result,
                "evidence_count": len(accomplishment.evidence_ids),
            }
        )
        edges.append(
            {
                "id": f"profile-accomplishment:{accomplishment.id}",
                "source": f"profile:{profile.id}",
                "target": node_id,
                "type": "achieved",
                "weight": 0.85,
            }
        )
        for skill_name in accomplishment.skills:
            matched_skill = skill_by_name.get(normalize_label(skill_name))
            if matched_skill:
                edges.append(
                    {
                        "id": f"accomplishment-skill:{accomplishment.id}:{matched_skill.id}",
                        "source": node_id,
                        "target": f"skill:{matched_skill.id}",
                        "type": "demonstrates",
                        "weight": 0.8,
                    }
                )
        for evidence_id in accomplishment.evidence_ids:
            if any(node["id"] == f"claim:{evidence_id}" for node in nodes):
                edges.append(
                    {
                        "id": f"accomplishment-claim:{accomplishment.id}:{evidence_id}",
                        "source": node_id,
                        "target": f"claim:{evidence_id}",
                        "type": "supported-by",
                        "weight": 0.9,
                    }
                )
    return {"nodes": nodes, "edges": edges}


def build_career_river(
    experiences: list[Experience], education: list[Education]
) -> list[dict[str, Any]]:
    """Return chronological events for a Sankey/timeline view with an accessible list fallback."""
    events = [
        {
            "id": item.id,
            "kind": "experience",
            "title": item.role,
            "organization": item.organization,
            "start": item.start_date,
            "end": item.end_date,
            "skills": item.skills,
        }
        for item in experiences
    ] + [
        {
            "id": item.id,
            "kind": "education",
            "title": item.credential,
            "organization": item.institution,
            "start": item.start_date,
            "end": item.end_date,
            "skills": [],
        }
        for item in education
    ]
    return sorted(events, key=lambda item: (item["start"], item["kind"], item["id"]))
