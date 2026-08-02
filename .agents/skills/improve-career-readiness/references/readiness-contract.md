# Readiness contract

- Generate for one role: `POST /api/matches/{opportunity_id}/recommendations`.
- List across roles: `GET /api/matches/recommendations/all`.
- Edit a plan: `PATCH /api/matches/recommendations/{recommendation_id}`.
- Create accepted action: `POST /api/matches/recommendations/{recommendation_id}/task` or `POST /api/pipeline/tasks`.
- Complete action: `POST /api/pipeline/tasks/{task_id}/complete`.

Recommendations are derived from the latest deterministic assessment. `impact`, `effort`, and `priority` are decision aids, not guarantees. Keep each action connected to its requirement IDs.
