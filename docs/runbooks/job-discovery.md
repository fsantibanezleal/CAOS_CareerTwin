# Job discovery

Open **Opportunities > Discover**. Combined search is the default: enter up to six public terms,
one per line, select Get on Board, Himalayas and/or Jobicy, and press **Search all selected sources**.
The leadership battery button fills editable terms but never submits them. Inspect the full plain-text
posting, geography, timezones, dates and salary period before saving. **Save for review** creates a
private source snapshot and opens the saved role. Review/re-extract its atomic requirements before
matching. Saving never sends an application, exports a CV or messages an employer.

## Coverage and filters

Get on Board supplies local, hybrid and remote technology postings, country filters and numbered
pages. Preserve source USD salary values but leave period and gross/net basis unknown when not
declared; do not assume monthly gross pay. Himalayas supports country codes, worldwide-only,
seniority and numbered pages. Jobicy supports
its live location taxonomy and opaque cursor pages; Chile is not a supported Jobicy slug, whereas
LATAM is. Always read the actual posting restrictions. Jobicy's free feed covers the last seven
days with a three-hour publication delay. These two sources focus on remote jobs, not the entire local
market. Search ranking is not a CareerTwin match score, and zero results is not a career verdict.

Country in combined search applies to Get on Board and Himalayas; Jobicy uses its separate live
location taxonomy. LATAM coverage is not Chile eligibility. Optional title-word filtering is
accent-insensitive token containment, not semantic fit. **One source** retains the individual
advanced filters and earlier single-source saved queries.

Source coverage reports retrieved, unavailable and not-run separately for each query/page. Counts
are filtered page results, not market totals. Continue or retry a single query while retaining
other results. Failed sources never imply zero vacancies. Results deduplicate exact source URLs.

Save up to twelve named first-page batteries privately. Neither loading nor saving runs a battery.
External links under **Additional sites and employer research** prepare manual LinkedIn,
ChileTrabajos, employer ATS and local recruitment research. They are not searched by the battery,
do not contribute result counts, and never receive private profile, documents or remuneration.

An application button or repost date does not establish an active requisition. Verify actual
employer status, leadership authority, contract and compensation before accepting a worthwhile
move. Saving is only reviewable capture, not a move approval. See [career strategy](career-strategy.md).
Unknown employer compensation does not prevent saving a relevant lead for user-authorized
research. Keep it in `watching` with explicit validation actions rather than treating missing pay
as rejection. Use named target portfolios to keep priority candidates, holds and alternatives
separate; do not silently exclude relevant shared postings from a requested comparison.

Saved searches contain only explicitly supplied query/filter values, are private to the seeker,
and run only after pressing Search. No periodic polling, inferred-profile submission or external
credential is involved. Public provider attribution remains attached to every imported snapshot.

## Native harness and skills

Run `scripts/career.ps1 doctor` (`career.sh` on POSIX). Place query JSON in ignored `data/private/`:

```json
{"provider":"himalayas","query":"data leadership","country":"CL","sort":"recent"}
```

```powershell
scripts/career.ps1 job-search --json-file data/private/query.json
scripts/career.ps1 job-battery --json-file data/private/battery.json
scripts/career.ps1 job-import --preview-file data/private/preview.json --index 0
```

Keep the first command's JSON output as the private preview file only if you need to import through
the harness; both searches return importable previews and index is explicitly zero-based.
A battery JSON file contains `{"searches": [<query objects>], "title_only": false}`, for example
three objects with the same explicit term and providers `getonbrd`, `himalayas` and `jobicy`.
Use `country: "CL"` for the first two and optional `geo: "latam"` for Jobicy.
Continuation submits the exact returned `next_search` in a new battery. Sessions stay in memory.
Never put private searches,
results, preview tickets or credentials in a commit. The `ingest-job-opportunity` skill v2.2.1
documents the same approval boundary. The harness refuses to import arbitrary client URLs/bodies.

## Failure handling

The provider adapters check HTTPS/DNS targets, refuse redirects and compression, bound responses
to 2 MiB and normalize at most 20 records per page. Invalid/expired records are excluded explicitly.
Do not retry a provider outage aggressively. A successful empty response differs from an outage.
Source requests do not include a user's profile, documents, cookies, employer credentials or token.

At most two batteries execute together with three source workers each, serialized/rate-spaced
requests per provider and thirty-second failure backoff. No new query starts after the battery's
thirty-second start budget; already running requests finish under bounded transport timeouts.
Capacity exhaustion returns 429. Never aggressively retry provider errors.

The in-memory public cache holds 64 pages for 15 minutes. Restart/eviction or an expired import
reference returns HTTP 410: rerun the search rather than weakening the verification. Duplicate
source URLs reuse an existing opportunity in the same workspace. No database migration is required.

For local research beyond Get on Board, use a legitimate local job board or employer career page,
then capture a single public posting with the existing URL/document/paste workflow. Never bypass
authentication, robots, CAPTCHA or scrape unsupported search endpoints.

See the [source research](../research/job-discovery-2026-10-03.md),
[requirements](../design/features/job-discovery/requirements.md) and
[release verification procedure](release-verification.md).
