"""Deterministic graph and timeline projections for interactive profile visualization."""

from __future__ import annotations

from typing import Any

from careertwin.models import Education, EvidenceClaim, Experience, ProfessionalProfile, Skill


def build_profile_graph(
    profile: ProfessionalProfile,
    skills: list[Skill],
    experiences: list[Experience],
    education: list[Education],
    claims: list[EvidenceClaim],
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
