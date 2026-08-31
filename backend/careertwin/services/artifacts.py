"""Deterministic evidence-grounded career artifact composition."""

from __future__ import annotations

from careertwin.models import Accomplishment, EvidenceClaim, Opportunity, ProfessionalProfile


def compose_artifact(
    kind: str,
    profile: ProfessionalProfile,
    claims: list[EvidenceClaim],
    opportunity: Opportunity | None,
) -> str:
    """Build a reviewable Markdown draft containing only curated or confirmed statements."""
    evidence_lines = [f"- {claim.statement} [evidence:{claim.id}]" for claim in claims]
    evidence = "\n".join(evidence_lines) or "- No confirmed evidence selected."
    target = (
        f"{opportunity.title} at {opportunity.employer}"
        if opportunity
        else "General professional use"
    )
    if kind == "resume":
        return (
            f"# {profile.headline or 'Professional profile'}\n\n"
            f"{profile.summary}\n\n## Evidence-backed highlights\n\n{evidence}\n\n"
            f"_Target: {target}. Review every line before export._"
        )
    if kind == "cover_letter":
        return (
            f"# Cover letter draft\n\nTarget: {target}\n\n"
            "Use the following verified evidence to compose a personal letter in your own voice:\n\n"
            f"{evidence}\n\n_No claim outside this evidence set has been added._"
        )
    if kind == "interview_brief":
        requirements = (
            "\n".join(f"- {item.label}" for item in opportunity.requirements)
            if opportunity
            else "- Select an opportunity to include requirements."
        )
        return (
            f"# Interview brief\n\n## Target\n\n{target}\n\n## Stated requirements\n\n"
            f"{requirements}\n\n## Verified evidence bank\n\n{evidence}"
        )
    return (
        f"# Follow-up draft\n\nTarget: {target}\n\n"
        "Thank the recipient, refer only to the verified topics below, and add the meeting-specific "
        f"details manually:\n\n{evidence}"
    )


def compose_resume_variant(
    profile: ProfessionalProfile,
    claims: list[EvidenceClaim],
    accomplishments: list[Accomplishment],
    opportunity: Opportunity | None,
    summary: str,
) -> str:
    """Compose a portable Markdown resume variant from confirmed records only."""
    target = (
        f"{opportunity.title} at {opportunity.employer}"
        if opportunity
        else "general professional use"
    )
    claim_lines = (
        "\n".join(f"- {claim.statement} [evidence:{claim.id}]" for claim in claims)
        or "- No evidence selected."
    )
    accomplishment_lines = (
        "\n".join(
            (
                f"- **{item.title}:** {item.action.strip()} {item.result.strip()} "
                f"[evidence:{','.join(item.evidence_ids)}]"
            ).strip()
            for item in accomplishments
        )
        or "- No confirmed accomplishments selected."
    )
    narrative = summary.strip() or profile.summary.strip()
    return (
        f"# {profile.headline or 'Professional profile'}\n\n"
        f"_Target: {target}_\n\n"
        f"## Summary\n\n{narrative}\n\n"
        f"## Evidence-backed accomplishments\n\n{accomplishment_lines}\n\n"
        f"## Confirmed evidence bank\n\n{claim_lines}\n\n"
        "_Review this variant before export. CareerTwin has not added unsupported claims._"
    )
