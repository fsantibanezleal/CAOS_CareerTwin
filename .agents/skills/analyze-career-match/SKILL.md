---
name: analyze-career-match
description: Run and explain CareerTwin's deterministic, versioned evidence alignment for a saved opportunity. Use when comparing confirmed profile evidence to reviewed job requirements, separating eligibility from weighted alignment, inspecting uncertainty and coverage, or explaining gaps. Never call the score a hiring probability or treat unknown evidence as weakness.
---

# Analyze Career Match

Skill contract version: 2.0.0.

## Outcome

Produce a reproducible match run and a plain-language evidence bridge from each opportunity requirement to confirmed profile evidence.

## Workflow

1. Read `Entry_point.md` and `references/match-semantics.md`.
2. Confirm the opportunity has reviewed atomic requirements and the profile has the intended confirmed evidence.
3. Run `scripts/career.ps1 match <opportunity-id>` or the `.sh` equivalent. If the same policy and canonical inputs were already run, reuse the immutable result returned by the service.
4. State the policy version and input digest.
5. Report hard eligibility separately as passed, failed, or unknown.
6. Report alignment only when the service returns a score. Always show evidence coverage and lower/upper uncertainty bounds.
7. Explain each assessment: met, partial, missing, unknown, or conflict; cite evidence IDs when present.
8. Compare saved roles only on their latest run and disclose differing coverage. Use `get /api/matches/portfolio/alignment` or the target-set endpoints through the native harness; retain explicit weights, role count, matched count, and shared-gap matrix.

## Interpretation rules

- "Unknown" means the current evidence cannot resolve the requirement.
- "Missing" means reviewed profile inputs do not currently support a requirement; it is not a statement about a person's inherent ability.
- Coverage is the share of weighted requirements that can be assessed from current evidence.
- The interval reflects unresolved evidence, not a statistical confidence interval about hiring.
- The score describes alignment to the user's saved requirements, not employability, suitability, worth, or hiring probability.

## Completion

Return opportunity ID, policy version, score or insufficient-evidence state, coverage, interval, eligibility, category components, and the highest-impact unresolved requirements.
