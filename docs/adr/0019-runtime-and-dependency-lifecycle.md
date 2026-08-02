# ADR 0019: Supported runtimes and deliberate dependency lifecycle

- Status: Accepted
- Date: 2026-08-02

## Context

An automated first scan opened independent pull requests for every available major, including
Node.js 26 while it is a Current release and breaking library updates that failed CareerTwin's
contracts. Individual green checks do not establish that a new runtime line is an appropriate
production baseline. Conversely, leaving GitHub Actions on mutable major tags weakens the
supply-chain boundary.

## Decision

Production uses the Python 3.12 container line and Node.js 24 LTS until an explicit migration issue
updates the support matrix. Local backend development remains compatible with Python 3.11 and
newer where the test suite passes. Production frontend builds use Node.js LTS only.

Every GitHub Action reference is pinned to a full immutable commit SHA with a version comment for
reviewability. Dependabot groups minor and patch version updates per ecosystem and limits concurrent
routine pull requests. Semantic-major library, action, and runtime changes require a focused issue,
release-note review, migration tests, and rollback assessment. Dependabot security updates remain
enabled and are not suppressed by the version-update policy.

## Consequences

Routine maintenance produces a small reviewable queue, while breaking changes cannot silently
replace a production runtime. Maintainers must review the baseline at least quarterly and sooner for
security or end-of-support events. Digest updates and vulnerability scans continue even when a
runtime major is held. Pinned Action SHAs trade convenience for provenance and Dependabot remains
responsible for proposing safe SHA refreshes.

## References

- [Node.js releases](https://nodejs.org/en/about/previous-releases)
- [Dependabot options reference](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference)
