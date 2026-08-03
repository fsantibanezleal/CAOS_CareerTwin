# ADR 0023: Encrypted document intelligence and evidence criticism

## Status

Superseded by ADR 0026. Retained as the 0.2.0 historical decision.

## Decision

Uploaded source bytes are tenant-namespaced and encrypted at rest with AES-256-GCM. The blob
envelope binds workspace, opaque content key, and key identifier as authenticated data. Encryption
keys and identifiers are runtime configuration; neither plaintext documents nor keys enter the
database, logs, repository, or container image. Operators run `careertwin encrypt-blobs` once when
upgrading a legacy volume and retain every required historical key until migration and restore
verification are complete.

Production malware scanning is fail-closed. After ClamAV acceptance, PDF, DOCX, and image content is
processed by a pinned private Docling gateway that exposes only the authenticated conversion subset
CareerTwin consumes. The gateway is non-root and distroless, serializes CPU conversions, bounds
files/pages/output, deletes temporary files, and uses official CPU-only PyTorch wheels. Scanned
English and Spanish content uses EasyOCR, while accurate or fast TableFormer modes preserve table
structure for résumé, portfolio, and job-requirement evidence. The required OpenCV image operations
come from a minimal source build with multimedia backends disabled, so the runtime does not contain
the prebuilt wheel's bundled FFmpeg payload. Plain text, Markdown, and bounded HTML use local parsers.
Extraction is a durable ARQ job with visible pending/ready/failed state and explicit retry.

The private Ollama extractor returns a versioned Pydantic schema. A deterministic critic accepts a
proposal only when its exact quotation is present, its token support is sufficient, it is not a
duplicate, and it contains no protected-trait inference. Accepted results remain proposed evidence;
only the seeker can confirm them.

## Consequences

- A lost encryption key makes the corresponding blobs unrecoverable; backup/restore exercises must
  include secret restoration without printing it.
- Model or OCR confidence never bypasses exact-source evidence or human confirmation.
- The deterministic parser used in `APP_ENV=test` is a test double, not a product mode.
- Docling and Ollama readiness are release and deployment gates.

## Evidence

- [Docling Serve REST API](https://docling-project.github.io/docling/usage/api_server/rest_api/)
- [Ollama structured outputs](https://docs.ollama.com/capabilities/structured-outputs)
