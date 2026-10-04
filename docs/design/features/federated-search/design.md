# Federated discovery and career strategy design

Extend the existing fixed-host discovery service, authenticated API and Opportunity store. Do not add
an independent search database, scraper or scoring model. Public preview caching remains separate
from private saved data. The adapter accepts only the documented Get on Board public endpoint,
expands bounded attribution/location relations and preserves missing fields.

The battery request contains up to six distinct text terms and three selected providers, mapped
to validated SearchRequest contracts. Numbered/cursor continuation uses exact typed requests, not
upstream URL following. Source workers run in parallel; each provider's terms remain serialized and
rate-spaced. A global semaphore bounds worker amplification. Failure/backoff and partial statuses
are visible. Result keys and canonical source URLs deduplicate; provenance identifies which queries
retrieved a result. Tickets are signed only after assembly for the current workspace. No worker
thread touches the database session. Existing private explicit import performs locking/snapshots/audit.

The default web action searches all supported sources. An expanded battery editor accepts newline
queries, selected providers and optional public geography. Named batteries are private preferences;
the UI can reopen or explicitly run them, inspect coverage and continue a particular source/query.
Public-site research links are a separate assisted lane, not fabricated native results.

Career strategy is validated private profile metadata: target titles, location/modalities, salary
basis/currency/period, optional current fixed pay, desired floor/uplift and transition costs, and
attributed dated market notes. A deterministic calculator computes a user-defined threshold only
when its inputs support it. Source offer values, research bands and decision thresholds remain
separate. No inferred qualifications or hidden mutable match-score changes are introduced.

Reuse shared shell, panels, dialogs, i18n, tokens and existing salary-band/graph workbenches. Server
contracts, pure calculation, auth/isolation and real source/browser verification gate deployment.
Technical wiki and ADR explain the budget, provenance, salary assumptions and local/API usage;
operational task/status/convergence records stay outside the public product repository.
