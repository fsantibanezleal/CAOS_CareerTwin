# ADR 0010: Treat every source as untrusted and bounded

- Status: Accepted
- Date: 2026-08-01

## Decision

Validate magic bytes and archive shape, impose byte/page/text limits, quarantine files, require ClamAV in production, and store opaque blobs outside the web root. URL capture permits public HTTP(S) only, rejects credentials/nonstandard ports/non-global addresses, pins the validated address while retaining TLS hostname verification, revalidates redirects, and bounds content.

## Consequences

The main upload/SSRF/parser risks fail closed. OCR is optional and isolated behind ingestion dependencies. Some valid documents/sites are rejected; explicit manual/paste entry is the fallback rather than weakened controls.
