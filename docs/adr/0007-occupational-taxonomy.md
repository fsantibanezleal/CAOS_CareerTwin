# ADR 0007: Pinned local ESCO with O*NET enrichment

- Status: Accepted
- Date: 2026-08-01

## Decision

Import pinned ESCO 1.2.1 locally for multilingual skill/occupation URIs and search. Do not send profile text to public taxonomy services. Import O*NET 30.3 as a local English, US-specific enrichment with release provenance and attribution. ADR 0025 defines the measured lexical, graph, and private-semantic retrieval implementation.

## Consequences

Normalization is reproducible and multilingual while concept URIs remain inspectable. Imports increase storage and require release provenance. O*NET must not be represented as global labor-market truth. Synonym/taxonomy mapping remains a suggestion until reviewed.
