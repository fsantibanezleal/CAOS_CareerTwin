---
name: improve-career-readiness
description: Turn CareerTwin match gaps and evidence coverage into transparent, candidate-controlled improvement actions. Use when prioritizing learning, portfolio evidence, profile clarification, application preparation, or opportunity-specific readiness. Never recommend fabrication, protected-trait changes, spam outreach, or a generic action without tracing it to a reviewed requirement.
---

# Improve Career Readiness

Skill contract version: 2.0.0.

## Outcome

Create a practical improvement plan grounded in the latest immutable requirement assessments and under the seeker's control.

## Workflow

1. Read `Entry_point.md` and `references/readiness-contract.md`.
2. Run or retrieve the latest match for the selected opportunity.
3. Regenerate recommendations with `scripts/career.ps1 recommend <opportunity-id>` or the `.sh` equivalent only when the current match reflects the intended profile and opportunity versions.
4. Separate actions into evidence, capability, positioning, application preparation, and eligibility clarification.
5. Rank by transparent impact, effort, and derived priority. Preserve associated requirement IDs.
6. Let the seeker edit prerequisites, steps, effort, status, and progress through the web UI or a bounded ignored JSON body passed to `scripts/career.* request`; preserve the gap rationale and requirement IDs.
7. Convert a selected recommendation into an agenda task only after the seeker chooses it.
8. Re-run matching only after canonical evidence or reviewed requirements actually change.

## Recommendation rules

- Prefer documenting existing work before recommending unnecessary training.
- For an unknown, first seek evidence or clarification.
- For a missing capability, propose bounded learning or a small demonstrable project; never imply guaranteed employment.
- For eligibility, recommend clarification and lawful alternatives, not evasion.
- Make opportunity-specific actions distinguishable from global recurring gaps.
- Do not optimize for vanity metrics, keyword stuffing, or deception.

## Completion

Return ranked actions with rationale, linked requirement IDs, impact, effort, priority, proposed next evidence, and any task dates explicitly accepted by the seeker.
