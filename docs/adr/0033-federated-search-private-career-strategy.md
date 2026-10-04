# 0033: Federated search and private career strategy

Status: accepted, 2026-10-04

## Context

Single-source remote feeds cannot support a seeker's local leadership search. A combined response
must retain source-specific restrictions and failures, not imply exhaustive coverage. Career moves
also require explicit compensation units and demonstrated authority; technical alignment alone is
insufficient. This decision extends [0031](0031-attributed-explicit-job-discovery.md).

## Decision

Add the documented Get on Board public API for local, hybrid and remote postings. Run explicitly
entered terms across selected sources in a bounded battery: six distinct terms, three providers,
two simultaneous batteries, three workers per battery, serialized/rate-spaced requests per provider,
and a 30-second start budget. Requests already running finish under bounded transport timeouts.
Return independent coverage, errors, filtered counts and continuations for every source/query.
Merge exact listing URLs while retaining query provenance. Failed sources are not empty successes.

Reuse the public page cache and workspace-bound signed previews. Only an explicit selected import
creates an attributed reviewable snapshot. Named first-page batteries remain private profile
preferences; saving does not run a search. Employer/board research links are a separate manual lane,
not scraped results or additional battery coverage.

Store career targets separately from confirmed experience. Persist validated strategy preferences
with optimistic revision control, retaining unrelated preferences. Compare fixed pay only when
currency, gross/net basis and period are explicit and compatible. Normalize month/year by twelve;
never infer taxes, exchange rates, variable pay, employer budgets or seniority. Threshold is the
maximum of the user's minimum and current fixed pay plus chosen uplift and recurring transition
cost. A benchmark remains research even above this threshold. No comparison mutates match scores,
opportunities or professional claims.

## Consequences

The web, native harness and repository skill use the same authenticated API. No schema migration,
new model service or secret-bearing job connector is required. Scope remains candidate assistance,
not automatic application. Feed availability, geographic eligibility, vacancy status, actual budget,
leadership authority and missing inputs are visible uncertainties, not fabricated confirmations.

Acceptance requires bounded execution, failures, tenant/CSRF/ticket isolation, preference revisions,
salary compatibility, EN/ES accessible controls, actual provider probes and rendered responsive
interaction. See [feature contracts](../design/features/federated-search/requirements.md),
[discovery](../runbooks/job-discovery.md) and [strategy](../runbooks/career-strategy.md).
