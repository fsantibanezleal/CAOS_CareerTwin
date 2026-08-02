# ADR 0010: Treat every source as untrusted and bounded

- Status: Accepted
- Date: 2026-08-01

## Decision

Validate magic bytes and archive shape, impose byte/page/text limits, quarantine files, require ClamAV in production, and store tenant-namespaced opaque blobs outside the web root under AES-256-GCM authenticated encryption. URL capture permits public HTTP(S) only, rejects credentials/nonstandard ports/non-global addresses, pins the validated address while retaining TLS hostname verification, revalidates redirects, and bounds content. PDF, DOCX, and image extraction crosses a pinned private Docling boundary after scanning and runs as a durable job; local parsing handles bounded plain formats. ADR 0023 defines the encryption, extraction, and evidence-criticism contract.

## Consequences

The main upload/SSRF/parser risks fail closed. Source state exposes pending, ready, or sanitized failure and supports explicit retry. Some valid documents/sites are rejected; explicit manual/paste entry is the fallback rather than weakened controls.
