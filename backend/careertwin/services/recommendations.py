"""Transparent improvement prioritization derived only from deterministic match gaps."""

from __future__ import annotations

from typing import Any


def build_recommendations(assessments: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Return sorted, explainable actions without inventing courses or credentials."""
    actions: list[dict[str, Any]] = []
    for item in assessments:
        if item["status"] == "met":
            continue
        missing = item["status"] == "missing"
        required = item["importance"] in {"required", "eligibility"}
        impact = 1.0 if missing and required else 0.72 if required else 0.45
        category = item.get("category", "evidence")
        if item["status"] == "unknown":
            kind = "evidence"
            title = f"Add evidence for {item['label']}"
            rationale = "The current profile cannot verify this requirement. Add or confirm exact evidence before treating it as a capability gap."
            effort = 0.25
        elif category == "skill":
            kind = "capability"
            title = f"Strengthen {item['label']}"
            rationale = "This capability is missing or only partially aligned with a stated opportunity requirement."
            effort = 0.7 if missing else 0.45
        else:
            kind = "presentation"
            title = f"Clarify {item['label']}"
            rationale = (
                "Existing evidence does not yet communicate this requirement strongly enough."
            )
            effort = 0.35
        priority = round(impact * (1.2 - effort), 4)
        actions.append(
            {
                "kind": kind,
                "title": title,
                "rationale": rationale,
                "requirement_ids": [item["requirement_id"]],
                "impact": impact,
                "effort": effort,
                "priority": priority,
            }
        )
    return sorted(actions, key=lambda item: (-item["priority"], item["title"]))
