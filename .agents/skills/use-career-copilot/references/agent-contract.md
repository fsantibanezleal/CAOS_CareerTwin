# Agent contract

## Native text path

- Provider state: `scripts/career.ps1 get /api/agent/providers`.
- Prompt/version manifest: `scripts/career.ps1 get /api/agent/contracts`.
- Durable turn: `scripts/career.ps1 chat "question" --provider xai --opportunity-id <optional-id>`.
- Runs: `GET /api/agent/runs`, `GET /api/agent/runs/{id}`, `POST /api/agent/runs/{id}/cancel`, and `POST /api/agent/runs/{id}/retry`.
- Conversations: `GET /api/agent/conversations` and `GET /api/agent/conversations/{id}/messages`.
- Proposed changes: `GET /api/agent/proposed-changes` and `POST /api/agent/proposed-changes/{id}/decision`.

The database row is the durable queue. The native worker transitions queued, claimed, retrying, running, and terminal states without Redis. A stopped worker preserves queued work; interrupted provider calls fail conservatively rather than being duplicated silently.

## Voice path

`POST /api/agent/voice/session` mints a five-minute xAI Realtime client secret with `Cache-Control: no-store`. Use it only inside the authenticated web client. Do not call it from a logging harness, paste its response into chat, or persist it. Audio streams between the browser and xAI; the CareerTwin VPS does not host or execute an audio model.

## Approval boundary

Provider output is typed and evidence-cited. A provider may propose a bounded profile patch, but only an explicit user decision can promote it. Model output never becomes canonical merely because a run completed.
