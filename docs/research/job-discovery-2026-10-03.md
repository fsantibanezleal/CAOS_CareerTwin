# Public job discovery research, 2026-10-03

## Question and verified sources

The seeker needs to discover real offers, inspect restrictions and save a private source snapshot
without disclosing a CV or scraping protected sites. The existing saved-role text filter is not an
external search tool. This research extends the approved CareerTwin product, issue #238.

| Source | Verified contract | Integration decision |
|---|---|---|
| [Himalayas API](https://himalayas.app/api), [OpenAPI](https://himalayas.app/docs/openapi.json) | Public keyword/country/seniority/type search, page pagination; attribution and original listing links required | Native backend adapter; no third-party public republishing |
| [Jobicy API](https://jobicy.com/jobs-rss-feed), [OpenAPI](https://jobicy.com/api/openapi.json) | Public keyword/location search, cursor pagination, supplied geographic restrictions; seven-day publication window with a three-hour delay | Native backend adapter; canonical Jobicy links, no commercial key or affiliate modification |
| [Remotive API](https://github.com/remotive-com/remote-jobs-api) | Redistribution rules constrain signup-gated presentation | Excluded from this invite-only workspace integration |

These are remote-job sources, not a census of employment or comprehensive Chilean vacancies.
LinkedIn/Indeed and authenticated employer sites are not scraped. Existing public URL, document,
pasted-text and manual capture remain available for opportunities obtained elsewhere.

## Live probes and adversarial observations

Live HTTPS probes returned valid JSON from both providers. Himalayas `q=python`, `country=CL`,
`sort=recent`, `page=1` returned a 20-item page with supplied Chile restrictions. Its live dates were
Unix seconds while its OpenAPI describes milliseconds; both must be accepted with explicit UTC
normalization. Live geographic restrictions were strings although the schema also documents
objects with `alpha2`/`name`. `categories` and plural `timezoneRestrictions` are the observed names.
Never substitute an example from documentation for real discovery results.

Jobicy `count=5&tag=python` returned listing IDs, canonical Jobicy URLs, HTML descriptions,
ISO-offset dates, geographic text, salary currency/period and an opaque `nextCursor`.
The live location taxonomy (`?get=locations`) included `latam` and `anywhere`, not `chile`.
Therefore a Chile filter must not be falsely represented as a supported Jobicy country query.
Locations are loaded from the provider taxonomy, not guessed indefinitely.

Jobicy recommends no more than hourly automated synchronization starts. CareerTwin does not add
automatic polling or background synchronization. Explicit searches use a bounded response cache
and a short process-wide provider cooldown; HTTP 429 is reported without retry storms. Himalayas
also documents rate limiting without promising an unrestricted quota.

## Security, privacy and data semantics

Only explicit search terms/filters leave the server. No profile, documents, evidence or credentials
are sent. Fixed HTTPS API paths use the existing public-IP resolver, IP-pinned TLS, no redirects,
identity encoding, bounded responses and timeouts. Provider HTML becomes plain text; remote logos,
scripts, tracking pixels and markup never execute in the browser. Only canonical provider HTTPS
listing links are exposed. Unsupported/malformed records are counted and excluded, not invented.

A bounded in-memory public-result cache is disposable; it is not a new durable job database.
Workspace-bound, expiring HMAC import tickets refer to server-normalized results. A user cannot
inject a URL or description in an import request, import another account's ticket, or mistake a
missing cache entry for an empty listing. Explicit import persists provenance and a content hash in
the existing tenant-owned opportunity/snapshot tables. No migration or database runtime change is
needed. Duplicate imports return the existing private opportunity instead of generating clutter.

Salary bounds are kept in the supplied currency and period. No annualization, FX conversion or
rank-by-compensation claim is added. A source's publication/expiry time is not an employer-verified
application deadline. Missing restrictions/dates/salary remain unknown; "remote" does not prove
worldwide eligibility. Search provider relevance is not CareerTwin alignment or hiring probability.

## Verification oracle

Adapter fixtures exercise real observed shapes, but are unit-test data only. Release acceptance
requires a separate live provider query, then an authenticated real UI search/preview/import flow
in a disposable seeker workspace, plus a repeat import and cross-workspace denial. Failures and
coverage limitations stay visible. No live employer content or personal records are committed.
