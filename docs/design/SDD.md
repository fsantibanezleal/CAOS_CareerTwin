# CareerTwin software design description

This is the implemented system's design baseline, not a claim that every external capability is
activated. The initial product plan was approved through the management repository's PR 500.
Incremental feature requirements and their executable gates live under `features/`.

## Person and authorization boundary

An invited account owns exactly one seeker workspace. A superuser manages accounts but their own
career data uses the same workspace boundary. Every private lookup and mutation filters by workspace;
PostgreSQL RLS is additional defense. Opaque revocable sessions, CSRF on mutations and secure cookies
protect production access. Login is the landing page; no public self-registration is exposed.

## Domain and evidence

PostgreSQL stores the canonical profile, experience, education, skills, sources, atomic claims,
opportunities, requirements, immutable matching runs, applications, contacts, calendar tasks,
recommendations and artifacts. SQLite is supported for isolated native development/tests, not the
production tenancy contract. Graphs are relational projections rather than independent truth stores.

Original uploads are bounded, quarantined, malware-scanned and encrypted as tenant-owned blobs.
Processing readiness is separate from an attachment's existence and from independent verification.
Authenticated source-text reading never accepts arbitrary storage keys. Claims carry provenance,
confidence and review state. Agent proposals cannot silently promote a claim or alter canonical data.

## Acquisition and orchestration

Manual forms, documents, pasted offers, bounded public URL ingestion, browser capture and the GitHub
connector feed evidence. GitHub tokens are supplied explicitly and stay in request memory; a shared
deployment credential is never repurposed as a seeker's connector grant. OAuth email/calendar
connections require individually authorized, encrypted least-privilege grants.

Job discovery uses documented Himalayas and Jobicy public interfaces. Search sends only explicit
terms and supported public filters. Provider-specific coverage, geography, dates and salary units are
shown without pretending that a remote feed covers a local market. A bounded public-memory cache is
distinct from private saved queries and jobs. Signed, expiring workspace-bound tickets authorize
explicit imports. Publication expiry is not a confirmed application deadline. Saving never applies.

Native commands, versioned repository skills and the web app share authenticated API contracts.
The durable database worker handles bounded queued tasks without an additional broker. The agent
router chooses a specialist, evidence critic and approval preview. Managed external model APIs are
optional capabilities with explicit unavailable states until an authorized key is configured; there
is no local-model service or production simulated response.

## Matching and planning

Immutable matching runs bind a profile revision and opportunity version. Requirement assessments,
eligibility, alignment and evidence coverage remain separate. Fit is not a hiring probability.
Recommendations reference actual gaps rather than inventing credentials or experience. Seeker-owned
application stages, tasks, meetings, contacts and reminders form the pipeline; dates and outcomes need
source support or an explicit user decision.

## Experience and visualization

The Today, Profile, Opportunities, Matches and Pipeline workbenches use sized layouts and internal
scroll regions. EN/ES and light/dark states are first-class. Profile/network graphs, requirement
matrices, opportunity landscape, career timeline and salary bands have textual interpretation and
empty/error states. Discovery adds attributed list/full-offer preview, explicit save and private
named queries. The shared architecture modal contains six bilingual SVG system views and links to
the complete public ADR register. Personal source material is never embedded in public assets.

## Delivery and operations

Local PowerShell/POSIX scripts install dependencies, initialize ignored secrets, bootstrap an invited
superuser, run the app/worker, test, back up and restore. VPS packaging is optional: TLS proxy, app,
worker, pinned PostgreSQL/pgvector and malware scanning. No database runtime/collation change is
bundled into the discovery release. Release flow is task PR to develop, then reviewed main promotion.

Native tests, typed/lint checks, dependency audits, secret scanning, final app/database image scans,
rendered desktop/mobile verification and live API journeys gate release. Encrypted SQL/blob recovery
sets must be restored and checked off-host before private reconciliation. Disk preflight and mandatory
release finishing retain the current image pair and two reviewed compatible rollback pairs. Unknown
resources, user volumes and backups are not generic-pruned. A passing build or HTTP 200 alone is not
release convergence. See the [ADR register](../adr/README.md) and
[feature convergence](features/job-discovery/tasks.md) for current evidence and remaining gates.
