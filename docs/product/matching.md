# Deterministic matching policy

Policy version: `match-v1.0.0`. The implementation is in `services/matching.py`; this document defines its public meaning.

## Inputs and identity

A run consumes the current profile revision, confirmed claims, curated skills/evidence links, experience, education, and one versioned opportunity with reviewed requirements. A canonical JSON representation produces an input SHA-256 digest. Policy version plus digest makes identical runs idempotent.

## Requirement assessment

- Skill requirements compare normalized labels/taxonomy identity, then level and evidence confidence.
- Experience/education/other text requirements compare normalized requirement text to confirmed claims and curated chronology.
- Each assessment is `met`, `partial`, `missing`, `unknown`, or `conflict` and carries evidence IDs and an explanation.
- Eligibility requirements are aggregated separately as `passed`, `failed`, or `unknown`; they are not diluted by preferred skills.

## Score, coverage, and bounds

For assessable non-eligibility requirements, the known weighted score is the weighted mean of assessment values. Coverage is assessable weight divided by total non-eligibility weight. Below the minimum coverage (`0.35`), `score` is `null`, not zero.

The lower bound treats unresolved weight as zero; the upper bound treats it as fully met. These are deterministic ignorance bounds, not statistical confidence intervals. Category components publish their own score, coverage, and denominator.

## Portfolio alignment

Only the latest run for each saved opportunity is included. The aggregate is coverage-weighted and always reports average coverage plus known-score count. It is a summary of the user's chosen opportunity set—not a labor-market statistic.

## Evaluation invariants

- Same canonical inputs and policy yield the same digest and result.
- Cross-tenant evidence never resolves a requirement.
- Adding unknown requirements cannot improve the known score and must reduce or preserve coverage.
- Failed eligibility is visible even when weighted skill alignment is high.
- Insufficient coverage produces no scalar score.
- Every “met” or “partial” assessment has a traceable basis.
