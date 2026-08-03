# Match API and semantics

Native command: `scripts/career.ps1 match <opportunity-id>` or `scripts/career.sh match <opportunity-id>`. Read other resources with `scripts/career.* get <relative-api-path>`.

- Run: `POST /api/matches/{opportunity_id}/run`.
- Latest: `GET /api/matches/{opportunity_id}/latest`.
- History: `GET /api/matches`.
- Portfolio alignment: `GET /api/matches/portfolio/alignment`.
- Named target alignment: `GET /api/matches/target-sets/{target_set_id}/alignment`.
- Named target gap matrix: `GET /api/matches/target-sets/{target_set_id}/recommendations`.

Policy `match-v1.0.0` is deterministic. A scalar score is withheld below minimum evidence coverage. Eligibility is not averaged into the weighted alignment score. Each run is immutable and keyed by policy version plus canonical input digest.
