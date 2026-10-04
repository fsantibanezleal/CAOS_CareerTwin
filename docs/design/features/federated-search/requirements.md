# Federated search and private career strategy requirements

Status: accepted

R-001 WHEN a seeker explicitly runs a battery, THE service SHALL search validated fixed-host sources
with at most six unique terms, three providers, two concurrent batteries and provider rate spacing.
Gate: tests/test_search_battery.py::test_battery_bounds_and_partial_failures

R-002 IF one source fails, THEN THE response SHALL retain successful results and report source/query
errors separately from empty successes, without treating its page count as whole-market coverage.
Gate: tests/test_search_battery.py::test_battery_bounds_and_partial_failures

R-003 WHEN offers recur across queries, THE system SHALL deduplicate exact identities, preserve
source provenance and issue workspace-bound import tickets without implicitly saving opportunities.
Gate: tests/test_search_battery.py::test_tickets_dedup_and_tenant_isolation

R-004 WHERE Get on Board is selected, THE adapter SHALL preserve observed local/hybrid/remote
restrictions, unknown salary period/basis and numbered continuations; malformed/moderation-rejected
records SHALL NOT be promoted into canonical career content.
Gate: tests/test_search_battery.py::test_getonbrd_normalization_and_pages

R-005 WHEN a seeker saves a named battery or career strategy, THE API SHALL validate it and persist
only in that workspace while preserving other preferences and optimistic profile revision.
Gate: tests/test_search_battery.py::test_private_batteries_and_strategy

R-006 IF current compensation or a salary basis/currency is unknown or incompatible, THEN move
evaluation SHALL expose missing inputs, not infer net/gross, an exchange rate or a hiring outcome.
Gate: tests/test_career_strategy.py::test_move_comparison_requires_compatible_inputs

R-007 WHEN filters, battery or strategy values change, THE UI SHALL react, expose actionable source
coverage, preserve explicit import and render EN/ES light/dark with bounded responsive scrolling.
Gate: frontend/src/components/JobDiscovery.test.tsx
Gate: frontend/src/components/FederatedSearch.test.tsx
Gate: frontend/src/components/CareerStrategy.test.tsx

R-008 WHEN external research links are offered, THE UI SHALL distinguish them from queried API
results and send only explicitly selected public search terms, never private profile/pay/documents.
Gate: tests/test_search_battery.py::test_external_research_links
