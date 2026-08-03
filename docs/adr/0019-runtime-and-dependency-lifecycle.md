# ADR 0019: Supported runtimes and deliberate dependency lifecycle

- Status: Partially superseded by ADR 0026
- Date: 2026-08-02

## Context

An automated first scan opened independent pull requests for every available major, including
Node.js 26 while it is a Current release and breaking library updates that failed CareerTwin's
contracts. Individual green checks do not establish that a new runtime line is an appropriate
production baseline. Conversely, leaving GitHub Actions on mutable major tags weakens the
supply-chain boundary.

## Decision

Production uses pinned, multi-architecture Chainguard Python 3.14.6 images: the `-dev` image only
builds a virtual environment, while the final non-root runtime is distroless and contains no shell
or package manager. This security migration was required when an up-to-date image scan found
fixable high-severity CPython findings in the prior base. Local backend development remains
compatible with Python 3.11 and newer where the test suite passes. Production frontend builds use
Node.js 24 LTS only.

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

Container CI uses the immutable Anchore scan action and an explicit Grype version. A 2026 Trivy
action supply-chain incident made a prior action lineage unsuitable; it was removed rather than
allowlisted. Release images fail on high or critical findings and publish an SPDX SBOM.

The same gate applies to every custom runtime, not only the web application. PostgreSQL/pgvector
and Ollama are compiled from exact upstream tags and commits recorded in their Dockerfiles. The
Docling gateway uses the narrow `docling-slim` feature set, official CPU-only PyTorch wheels, fixed
Pillow and OpenCV releases, EasyOCR for English/Spanish scans, and TableFormer for table structure.
OpenCV is compiled from its pinned source distribution with only core, image codec, image processing,
and Python-binding modules. Its OpenCV 5 compatibility patch makes only missing generated typing
artifacts optional in the wheel manifest; runtime binaries and APIs remain mandatory and unchanged.
FFmpeg, GStreamer, V4L, IEEE-1394, OpenCL, IPP, and extra CPU
dispatch are disabled. Build tools and package databases remain in build stages; runtime images
receive only the required artifacts.

Provider-facing structured-output schemas must also remain compatible with the local llama.cpp
grammar compiler. Large string repetition bounds are enforced after generation with typed runtime
validation instead of being emitted as JSON Schema `maxLength`; model output-token limits still
bound generation before validation.
If a small local model returns otherwise valid visible output plus write operations without any
citations, the local adapter discards only those unsafe operations and revalidates the complete
draft. It does not repair malformed answers, fabricate citations, or weaken the evidence critic.
An incomplete or otherwise invalid local structured response receives one bounded provider retry
with an explicit complete-JSON correction and a lower output ceiling. The replacement is validated
from scratch; there is no heuristic JSON repair and a second invalid response fails closed.

## References

- [Node.js releases](https://nodejs.org/en/about/previous-releases)
- [Chainguard Python image](https://images.chainguard.dev/directory/image/python/overview)
- [Trivy ecosystem advisory GHSA-69fq-xp46-6x23](https://github.com/aquasecurity/trivy/security/advisories/GHSA-69fq-xp46-6x23)
- [Anchore scan action](https://github.com/anchore/scan-action)
- [Grype](https://github.com/anchore/grype)
- [Dependabot options reference](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference)
