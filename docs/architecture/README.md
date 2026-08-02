# Architecture

CareerTwin is a modular monolith with explicit deterministic and probabilistic lanes. The monolith keeps transactions and tenant boundaries understandable for a personal self-hosted system; worker processes handle slow or resumable jobs. PostgreSQL is canonical, while graph and chart structures are projections, not independent truth stores.

## 1. System view

```mermaid
flowchart LR
  B[React workbench] -->|opaque session + CSRF| A[FastAPI command/query API]
  A --> P[(PostgreSQL + pgvector)]
  A --> R[(Redis)]
  A --> S[(private blob store)]
  W[ARQ worker] --> R
  W --> P
  W --> S
  A --> G[GitHub API]
  A --> L[optional model providers]
  C[ClamAV] --> A
  C --> W
```

The browser never receives provider keys or storage paths. The API validates tenant ownership and sets PostgreSQL session context. The worker repeats that context before processing a private source.

## 2. Evidence lifecycle

```mermaid
flowchart LR
  X[document / manual / GitHub] --> Q[quarantine and bounded extraction]
  Q --> S[source snapshot + hash]
  S --> C[atomic proposed claims]
  C --> H{seeker decision}
  H -->|confirm| E[canonical evidence]
  H -->|reject| J[decision history]
  E --> K[skills / profile graph / artifacts / matching]
```

Extractors never update canonical profile fields. A claim retains source ID, locator, confidence, lifecycle state, and decision note.

## 3. Agent view

```mermaid
flowchart LR
  U[user message] --> I[intent router]
  I --> X[bounded specialist]
  X --> V[evidence critic]
  V --> O[visible answer + citations]
  V --> D[proposed JSON operations]
  D --> H{human approval}
  H -->|approve| C[allowlisted deterministic commit]
  H -->|reject| N[no canonical change]
```

The first alpha stores durable `AgentRun` state and visible conversation records. Production checkpoint integration is designed around PostgreSQL; canonical mutation remains outside the model graph.

## 4. Tenant/security view

```mermaid
flowchart TB
  L[invite-only login] --> A[Argon2id verification]
  A --> S[opaque revocable session]
  S --> C[CSRF double-submit check]
  C --> T[workspace dependency]
  T --> R[PostgreSQL RLS context]
  R --> D[tenant rows]
  M[superuser] --> U[account lifecycle only]
  U -. no content endpoint .-> D
```

Application scoping and forced RLS are defense in depth. Owners/migration roles must be separated from the runtime role in production because table owners can bypass RLS unless forced and correctly configured.

## 5. Domain/data view

```mermaid
erDiagram
  USER ||--|| WORKSPACE : owns
  WORKSPACE ||--|| PROFILE : describes
  WORKSPACE ||--o{ SOURCE : controls
  SOURCE ||--o{ EVIDENCE_CLAIM : proposes
  PROFILE ||--o{ SKILL : curates
  SKILL }o--o{ EVIDENCE_CLAIM : supported_by
  WORKSPACE ||--o{ OPPORTUNITY : researches
  OPPORTUNITY ||--o{ REQUIREMENT : contains
  OPPORTUNITY ||--o{ MATCH_RUN : evaluated_by
  OPPORTUNITY ||--o| APPLICATION : tracked_as
  APPLICATION ||--o{ STAGE_EVENT : records
  WORKSPACE ||--o{ CAREER_TASK : plans
```

## 6. Deployment view

```mermaid
flowchart LR
  Internet --> TLS[TLS reverse proxy]
  TLS --> App[app container]
  App --> DB[(persistent PostgreSQL)]
  App --> Redis[(persistent Redis)]
  Worker[worker container] --> DB
  Worker --> Redis
  App --> AV[ClamAV]
  Worker --> AV
  App --> Blob[(persistent blobs)]
  Worker --> Blob
  DB --> Backup[encrypted off-host backup]
  Blob --> Backup
```

`compose.yaml` includes a one-shot migration service and health-gated app/worker services. Production adds a reverse proxy, secret injection, resource limits, monitoring, and scheduled backup/restore verification.

## Code map

- `backend/careertwin/models.py`: relational domain.
- `backend/careertwin/api/`: authenticated command/query endpoints.
- `backend/careertwin/services/`: deterministic ingestion, graph, matching, recommendation, artifact, security, and connector services.
- `backend/careertwin/agent/`: provider abstraction and bounded graph.
- `backend/careertwin/worker.py`: resumable ingestion, retention, and reminder seams.
- `frontend/src/pages/`: user workflows.
- `frontend/src/components/Visualizations.tsx`: graph/chart projections with accessible alternatives.
