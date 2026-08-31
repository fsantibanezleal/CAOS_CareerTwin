"""Versioned deterministic opportunity alignment with coverage and uncertainty bounds."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from typing import Any

from careertwin.models import (
    Education,
    EvidenceClaim,
    Experience,
    Opportunity,
    ProfessionalProfile,
    Skill,
)
from careertwin.services.normalization import label_similarity, normalize_label

POLICY_VERSION = "match-v1.0.0"
MINIMUM_COVERAGE = 0.35


@dataclass(frozen=True)
class MatchCalculation:
    """Pure result produced from explicit profile and opportunity inputs."""

    input_digest: str
    score: float | None
    lower_bound: float
    upper_bound: float
    coverage: float
    eligibility: str
    components: dict[str, Any]
    assessments: list[dict[str, Any]]


def _round(value: float) -> float:
    return round(max(0.0, min(1.0, value)), 4)


def _canonical_digest(payload: dict[str, Any]) -> str:
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    return hashlib.sha256(encoded.encode()).hexdigest()


def _skill_assessment(requirement: Any, skills: list[Skill]) -> dict[str, Any]:
    candidates = sorted(
        (
            (
                max(
                    label_similarity(requirement.normalized_name, skill.normalized_name),
                    1.0
                    if requirement.taxonomy_uri and requirement.taxonomy_uri == skill.taxonomy_uri
                    else 0.0,
                ),
                skill,
            )
            for skill in skills
        ),
        key=lambda item: (item[0], item[1].confidence, item[1].level),
        reverse=True,
    )
    if not candidates or candidates[0][0] < 0.55:
        return {
            "status": "missing",
            "score": 0.0,
            "evidence_ids": [],
            "explanation": "No confirmed profile skill is sufficiently similar.",
        }
    similarity, skill = candidates[0]
    required_level = requirement.minimum_level
    level_factor = (
        1.0 if required_level is None else min(1.0, skill.level / max(required_level, 0.01))
    )
    score = _round(similarity * level_factor * (0.7 + 0.3 * skill.confidence))
    status = "met" if score >= 0.8 else "partial"
    return {
        "status": status,
        "score": score,
        "evidence_ids": sorted(
            claim.id for claim in skill.evidence if claim.state.value == "confirmed"
        ),
        "explanation": f"Best supported profile capability: {skill.name}.",
    }


def _text_assessment(requirement: Any, corpus: list[tuple[str, list[str]]]) -> dict[str, Any]:
    candidates = sorted(
        (
            (label_similarity(requirement.normalized_name, text), evidence)
            for text, evidence in corpus
        ),
        key=lambda item: item[0],
        reverse=True,
    )
    if not candidates or candidates[0][0] < 0.4:
        return {
            "status": "unknown",
            "score": None,
            "evidence_ids": [],
            "explanation": "Available confirmed evidence does not resolve this requirement.",
        }
    similarity, evidence = candidates[0]
    return {
        "status": "met" if similarity >= 0.75 else "partial",
        "score": _round(similarity),
        "evidence_ids": evidence,
        "explanation": "Resolved against confirmed profile evidence.",
    }


def calculate_match(
    profile: ProfessionalProfile,
    skills: list[Skill],
    experiences: list[Experience],
    education: list[Education],
    claims: list[EvidenceClaim],
    opportunity: Opportunity,
) -> MatchCalculation:
    """Calculate an explainable alignment score; this is never a hiring probability."""
    confirmed_claims = [claim for claim in claims if claim.state.value == "confirmed"]
    claim_corpus = [(claim.statement, [claim.id]) for claim in confirmed_claims]
    experience_corpus: list[tuple[str, list[str]]] = [
        (" ".join([item.role, item.organization, item.summary, *item.skills]), [])
        for item in experiences
    ]
    education_corpus: list[tuple[str, list[str]]] = [
        (" ".join([item.credential, item.field, item.institution, item.details]), [])
        for item in education
    ]
    general_corpus = claim_corpus + experience_corpus + education_corpus

    assessments: list[dict[str, Any]] = []
    for requirement in sorted(opportunity.requirements, key=lambda item: item.id):
        if requirement.category == "skill":
            outcome = _skill_assessment(requirement, skills)
        elif requirement.category == "experience":
            outcome = _text_assessment(requirement, claim_corpus + experience_corpus)
        elif requirement.category == "education":
            outcome = _text_assessment(requirement, claim_corpus + education_corpus)
        elif requirement.category == "seniority":
            similarity = label_similarity(requirement.normalized_name, profile.seniority)
            outcome = {
                "status": "met"
                if similarity >= 0.75
                else ("partial" if similarity >= 0.4 else "unknown"),
                "score": _round(similarity) if profile.seniority else None,
                "evidence_ids": [],
                "explanation": "Compared with the user-curated seniority field.",
            }
        elif requirement.category == "location":
            similarity = label_similarity(requirement.normalized_name, profile.location)
            outcome = {
                "status": "met"
                if similarity >= 0.65
                else ("partial" if similarity >= 0.3 else "unknown"),
                "score": _round(similarity) if profile.location else None,
                "evidence_ids": [],
                "explanation": "Compared with the user-curated location and work preference.",
            }
        else:
            outcome = _text_assessment(requirement, general_corpus)
        assessments.append(
            {
                "requirement_id": requirement.id,
                "label": requirement.label,
                "category": requirement.category,
                "importance": requirement.importance,
                "weight": requirement.weight,
                **outcome,
            }
        )

    total_weight = sum(item["weight"] for item in assessments) or 1.0
    known_weight = sum(item["weight"] for item in assessments if item["score"] is not None)
    weighted_known = sum(
        item["weight"] * item["score"] for item in assessments if item["score"] is not None
    )
    coverage = _round(known_weight / total_weight)
    lower = _round(weighted_known / total_weight)
    upper = _round((weighted_known + total_weight - known_weight) / total_weight)
    known_score = _round(weighted_known / known_weight) if known_weight else 0.0
    score = known_score if coverage >= MINIMUM_COVERAGE else None

    eligibility_items = [item for item in assessments if item["importance"] == "eligibility"]
    if any(item["status"] in {"missing", "conflict"} for item in eligibility_items):
        eligibility = "conflict"
    elif any(item["status"] == "unknown" for item in eligibility_items):
        eligibility = "unknown"
    else:
        eligibility = "eligible"

    component_values: dict[str, dict[str, float | int]] = {}
    for category in sorted({item["category"] for item in assessments}):
        members = [item for item in assessments if item["category"] == category]
        weight = sum(item["weight"] for item in members)
        known = [item for item in members if item["score"] is not None]
        known_component_weight = sum(item["weight"] for item in known)
        component_values[category] = {
            "score": _round(
                sum(item["weight"] * item["score"] for item in known) / known_component_weight
            )
            if known_component_weight
            else 0.0,
            "coverage": _round(known_component_weight / weight) if weight else 0.0,
            "requirements": len(members),
        }

    payload = {
        "policy": POLICY_VERSION,
        "profile": {
            "revision": profile.revision,
            "seniority": normalize_label(profile.seniority),
            "location": normalize_label(profile.location),
        },
        "skills": [
            [
                skill.normalized_name,
                skill.level,
                skill.confidence,
                sorted(c.id for c in skill.evidence),
            ]
            for skill in sorted(skills, key=lambda item: item.id)
        ],
        "claims": sorted(claim.id for claim in confirmed_claims),
        "opportunity": [opportunity.id, opportunity.version],
        "requirements": [
            [item["requirement_id"], item["status"], item["score"], item["evidence_ids"]]
            for item in assessments
        ],
    }
    return MatchCalculation(
        input_digest=_canonical_digest(payload),
        score=score,
        lower_bound=lower,
        upper_bound=upper,
        coverage=coverage,
        eligibility=eligibility,
        components={
            "by_category": component_values,
            "known_score": known_score,
            "insufficient_evidence": score is None,
            "meaning": "Evidence alignment, not hiring probability",
        },
        assessments=assessments,
    )
