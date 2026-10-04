# Job discovery

Open **Opportunities**, then **Discover**. Select Himalayas or Jobicy, enter your role/skill terms,
optionally choose location filters, and press **Search job offers**. Inspect the full plain-text
posting, geography, timezones, dates and salary period before saving. **Save for review** creates a
private source snapshot and opens the saved role. Review/re-extract its atomic requirements before
matching. Saving never sends an application, exports a CV or messages an employer.

Himalayas supports country codes, worldwide-only, seniority and numbered pages. Jobicy supports
its live location taxonomy and opaque cursor pages; Chile is not a supported Jobicy slug, whereas
LATAM is. Always read the actual posting restrictions. Jobicy's free feed covers the last seven
days with a three-hour publication delay. Both sources focus on remote jobs, not the entire local
market. Search ranking is not a CareerTwin match score, and zero results is not a career verdict.

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
scripts/career.ps1 job-import --preview-file data/private/preview.json --index 0
```

Keep the first command's JSON output as the private preview file only if you need to import through
the harness; index is explicitly zero-based. Sessions stay in memory. Never put private searches,
results, preview tickets or credentials in a commit. The `ingest-job-opportunity` skill v2.1.0
documents the same approval boundary. The harness refuses to import arbitrary client URLs/bodies.

## Failure handling

The provider adapters check HTTPS/DNS targets, refuse redirects and compression, bound responses
to 2 MiB and normalize at most 20 records per page. Invalid/expired records are excluded explicitly.
Do not retry a provider outage aggressively. A successful empty response differs from an outage.
Source requests do not include a user's profile, documents, cookies, employer credentials or token.

The in-memory public cache holds 32 pages for 15 minutes. Restart/eviction or an expired import
reference returns HTTP 410: rerun the search rather than weakening the verification. Duplicate
source URLs reuse an existing opportunity in the same workspace. No database migration is required.

For Santiago onsite/hybrid research, use a legitimate local job board or employer career page,
then capture a single public posting with the existing URL/document/paste workflow. Never bypass
authentication, robots, CAPTCHA or scrape unsupported search endpoints.

See the [source research](../research/job-discovery-2026-10-03.md),
[requirements](../design/features/job-discovery/requirements.md) and
[release verification procedure](release-verification.md).
