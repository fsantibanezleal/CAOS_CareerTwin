# Private career strategy

Open **Profile > Career strategy**. Enter demonstrated current responsibility and desired titles,
location, work modalities, positioning and evidence priorities. Target titles are aspirations,
not additions to your employment history. Saving preserves unrelated profile preferences and uses
revision control; after a conflict reload and reconcile rather than overwriting another edit.

## Research candidates and validated moves

Save a relevant role for research even when employer compensation is unknown. Use `watching`,
retain the source and check date, and explain the fit, progression potential and unresolved inputs.
Missing pay means financial validation is pending; it does not mean the role is irrelevant or the
seeker is unqualified. A saved role is not an application or a recommendation to resign.

Use **Opportunities > Target portfolios** to separate priority/conditional screening, roles on
hold and lower-priority alternatives. When the seeker requests a complete comparison, preserve
the weaker roles with their reasons rather than silently discarding them. Keep analyst assessments
clearly labelled in the research notes, separate from employer requirements. Review atomic
requirements before calculating a match, then use the full confirmed profile and disclose evidence
coverage and hard eligibility. A high alignment score does not establish advancement or salary.

Create private validation tasks for actual pay units and total package, reporting line, direct
reports, hiring/budget authority, active requisition, contract and location eligibility. Leave
deadlines blank unless sourced or supplied by the seeker. No employer contact or application is
sent by saving a role, a target portfolio, a match run or a task.

## Compensation

Choose an explicit currency, gross/net basis and monthly/annual period. Keep current fixed pay and
an optional explicit floor private. Unknown current compensation stays blank. Choose an uplift
percentage and recurring transition cost in the same period as your current pay.

The scenario threshold is:

`max(explicit minimum, current fixed pay * (1 + uplift / 100) + recurring transition cost)`

Missing current pay prevents deriving its uplift threshold. An explicit floor can still define a
scenario, with the missing baseline disclosed. This is not an employer budget or salary prediction.
Variable bonuses, benefits, employment versus contracting, commute and transition risk need separate
assessment. Annual/monthly conversion assumes twelve equal periods, not a guaranteed bonus.

In **Evaluate a salary scenario**, distinguish declared employer compensation from a market
benchmark. Supply the offer's currency, basis, period and fixed range. Unknown units, currency
differences and gross/net mismatches prevent comparison: the app never guesses exchange rates or
tax deductions. A benchmark above the floor is still only research. A compatible employer range
can be below, above or overlapping the threshold; none establishes career advancement by itself.
Editing an input clears the stale comparison.

Optional attributed research records include HTTPS source URL, check date, units, range and notes.
Keep personal remuneration and real employment records out of public issues, screenshots and Git.
Before approving a move independently verify active requisition, authority, reporting line, team,
budget, evidence match, geography, total compensation and contract conditions.

## Native and skill workflows

Use the same instance as the web client. `scripts/career.sh` is the POSIX equivalent:

```powershell
scripts/career.ps1 get /api/job-search/strategy
scripts/career.ps1 request PUT /api/job-search/strategy --json-file data/private/strategy.json
scripts/career.ps1 request POST /api/job-search/strategy/compare --json-file data/private/scenario.json
```

The save file contains `{"strategy": {...}, "revision": <current profile revision>}`.
The compare file contains `{"strategy": {...}, "offer": {...}}`; offer fields are `currency`,
`basis`, `period`, `low`, `high`, and `kind` (`employer` or `benchmark`). Read
`/api/openapi.json` for the exact validated models. Keep files and returned data in ignored
`data/private/`; credentials are prompted without echo and sessions stay in memory.

The repository-local `ingest-job-opportunity` skill routes from discovery to this assessment.
It does not authorize imports, applications or promotion of unconfirmed professional claims.
