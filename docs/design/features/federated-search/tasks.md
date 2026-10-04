# Federated search implementation tasks

This sequence implements the requirements and design in this directory. Each unit includes its
tests and documentation; release acceptance requires all named gates, not only a successful build.

1. Validate fixed-host Get on Board normalization, restrictions and pagination (R-004).
2. Complete bounded source workers, independent failures, deduplication and tenant tickets (R-001,
   R-002, R-003), including concurrency and backoff tests.
3. Complete private saved batteries, strategy revision control and deterministic compatible-pay
   comparisons (R-005, R-006).
4. Integrate the default combined web search, battery editing, source coverage, independent
   continuations and explicitly separate research links (R-007, R-008).
5. Integrate private strategy editing and reactive offer comparisons without changing canonical
   match scores or exporting profile data (R-006, R-007).
6. Complete API/CLI guides, architecture content and EN/ES accessibility and rendered interaction
   checks (R-007, R-008). Verify actual provider responses separately from synthetic test fixtures.
7. Run regression, privacy, security and release gates; deploy the reviewed exact main commit with
   backup/recovery verification and bounded application-image retention. Keep release coordination
   and evidence outside public product source.
