# ADR 0017: Compose-first VPS persistence and verified restoration

- Status: Superseded by ADR 0026
- Date: 2026-08-01

## Decision

Ship multi-stage application and Docling gateway images with digest-pinned Node and Chainguard Python build/runtime bases. Both final Python images are distroless, run as UID 65532, and contain neither a shell, package manager, nor dependency installer. The Docling build pins official CPU-only PyTorch wheels and retains EasyOCR plus TableFormer for scanned English/Spanish content and structured tables. OpenCV is built from pinned source with only core image-decoding/processing and Python bindings; FFmpeg, GStreamer, V4L, IEEE-1394, OpenCL, and unused CPU-dispatch variants are disabled. The VPS therefore carries neither CUDA libraries nor OpenCV's bundled multimedia payload. Compose builds a PostgreSQL 17.10 image with pgvector 0.8.6 from pinned source and a CPU-only Ollama 0.32.5 image from pinned source, then uses digest-pinned Redis and ClamAV alongside them. Ollama also runs as UID/GID 65532; a root-only, one-shot initializer may change ownership only inside its named model volume so upgrades from the earlier root-owned layout remain safe. Persistent database, blob, queue, scanner, document-model, and language-model volumes survive releases. The app port binds to loopback so only the TLS reverse proxy is public. Production adds secret injection and encrypted off-host backups. A backup is not verified until an isolated restore test passes. CI builds, rejects high or critical findings in, and publishes an SBOM for every custom runtime image.

## Consequences

Local and VPS topology remain similar, restarts preserve state, and migrations precede app/worker. Operators own capacity, proxy, monitoring, and backup schedules. Application rollback cannot destructively downgrade the database.
