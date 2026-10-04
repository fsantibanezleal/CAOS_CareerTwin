# Job discovery requirements

Status: planned

Functional scope authorized by the user's request to add a job-offer search tool and deploy fixes.
The technical design is in [design.md](design.md); research precedes implementation.

R-001 THE search service SHALL query only documented public provider endpoints with bounded,
IP-pinned HTTPS, no redirects, and plain-text normalization.
Gate: tests/test_job_discovery.py::test_fetch_boundary

R-002 WHEN a seeker explicitly searches, THE API SHALL transmit only the supplied query/filters,
return attributed real listings and distinguish provider failures from successful empty results.
Gate: tests/test_job_discovery.py::test_search_contract

R-003 THE adapters SHALL preserve geographic/timezone restrictions, salary units and UTC dates,
and reject unsafe links or malformed records without inventing fields.
Gate: tests/test_job_discovery.py::test_normalization

R-004 WHEN a seeker explicitly saves a preview, THE API SHALL verify an expiring workspace-bound
ticket and persist a private provenance-bearing opportunity snapshot without auto-applying.
Gate: tests/test_job_discovery.py::test_import_isolation_and_provenance

R-005 IF a listing is already saved in the workspace, THEN THE API SHALL return the existing role;
IF its cache/ticket expires, THEN THE API SHALL require a fresh search.
Gate: tests/test_job_discovery.py::test_duplicate_and_expired_import

R-006 THE service SHALL bound cache size and request rate, and SHALL NOT poll providers in the
background or persist search queries, credentials or employer content in Git.
Gate: tests/test_job_discovery.py::test_cache_and_cooldown

R-007 THE workbench SHALL expose discovery by clicking from Opportunities, support preview,
pagination and explicit saving, and provide translated EN/ES controls in both themes.
Gate: frontend/src/components/JobDiscovery.test.tsx

R-008 THE repository SHALL expose equivalent search/import commands through the native harness,
document source limits and operational failure handling, and describe the flow in-app.
Gate: tests/test_native_harness.py

R-009 THE release SHALL pass native verification, final-image security scanning, live provider
search/import and viewport checks before it is reported deployed.
Gate: docs/design/features/job-discovery/tasks.md
