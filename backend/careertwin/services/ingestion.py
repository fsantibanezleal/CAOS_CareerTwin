"""Bounded document inspection, malware scanning and text extraction."""

from __future__ import annotations

import io
import json
import socket
import tempfile
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import httpx
from docx import Document
from pypdf import PdfReader
from trafilatura import extract

from careertwin.config import Settings

ALLOWED_MEDIA = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "text/markdown",
    "text/html",
    "image/jpeg",
    "image/png",
}


@dataclass(frozen=True)
class Inspection:
    media_type: str
    safe: bool
    reason: str


@dataclass(frozen=True)
class DocumentExtraction:
    """Normalized document result with provenance suitable for a review inbox."""

    text: str
    engine: str
    confidence: float
    spans: list[dict[str, int]]
    timings: dict[str, Any]
    warnings: list[str]


def inspect_content(content: bytes, declared_type: str | None, filename: str) -> Inspection:
    """Validate magic bytes, archive shape and extension instead of trusting browser MIME data."""
    if content.startswith(b"%PDF-"):
        detected = "application/pdf"
    elif content.startswith(b"\x89PNG\r\n\x1a\n"):
        detected = "image/png"
    elif content.startswith(b"\xff\xd8\xff"):
        detected = "image/jpeg"
    elif content.startswith(b"PK\x03\x04"):
        try:
            with zipfile.ZipFile(io.BytesIO(content)) as archive:
                names = set(archive.namelist())
                if "word/document.xml" not in names or len(names) > 5_000:
                    return Inspection("application/zip", False, "Archive is not a bounded DOCX")
                if sum(info.file_size for info in archive.infolist()) > 100 * 1024 * 1024:
                    return Inspection("application/zip", False, "Expanded archive is too large")
            detected = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        except zipfile.BadZipFile:
            return Inspection("application/zip", False, "Invalid ZIP container")
    else:
        if b"\x00" in content[:8192]:
            return Inspection("application/octet-stream", False, "Binary content is not supported")
        suffix = Path(filename).suffix.casefold()
        detected = {
            ".md": "text/markdown",
            ".html": "text/html",
            ".htm": "text/html",
        }.get(suffix, "text/plain")
    if detected not in ALLOWED_MEDIA:
        return Inspection(detected, False, "Unsupported content type")
    if declared_type and declared_type not in {detected, "application/octet-stream"}:
        return Inspection(detected, False, "Declared and detected content types differ")
    return Inspection(detected, True, "accepted")


def clamav_scan(content: bytes, host: str | None, port: int = 3310) -> tuple[bool, str]:
    """Scan bytes with ClamAV INSTREAM; development may explicitly run without a configured host."""
    if not host:
        return True, "scanner-not-configured"
    with socket.create_connection((host, port), timeout=10) as connection:
        connection.sendall(b"zINSTREAM\0")
        view = memoryview(content)
        for offset in range(0, len(view), 8192):
            chunk = view[offset : offset + 8192]
            connection.sendall(len(chunk).to_bytes(4, "big"))
            connection.sendall(chunk)
        connection.sendall((0).to_bytes(4, "big"))
        response = connection.recv(4096).decode(errors="replace")
    return response.rstrip("\0\n").endswith("OK"), response.rstrip("\0\n")


def clamav_ready(host: str | None, port: int = 3310) -> bool:
    """Return whether the configured clamd socket answers its protocol-level ping."""
    if not host:
        return False
    try:
        with socket.create_connection((host, port), timeout=3) as connection:
            connection.sendall(b"zPING\0")
            return connection.recv(64).decode(errors="replace").rstrip("\0\n") == "PONG"
    except OSError:
        return False


def extract_text(content: bytes, media_type: str) -> str:
    """Extract normalized text while treating document contents strictly as untrusted data."""
    if media_type == "application/pdf":
        reader = PdfReader(io.BytesIO(content))
        if len(reader.pages) > 300:
            raise ValueError("PDF page count exceeds the configured limit")
        text = "\n\n".join((page.extract_text() or "") for page in reader.pages)
    elif media_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        document = Document(io.BytesIO(content))
        text = "\n".join(paragraph.text for paragraph in document.paragraphs)
    elif media_type == "text/html":
        decoded = content.decode("utf-8", errors="replace")
        text = extract(decoded, include_links=False, include_images=False) or ""
    elif media_type in {"image/jpeg", "image/png"}:
        try:
            from docling.document_converter import (  # type: ignore[import-not-found]
                DocumentConverter,
            )
        except ImportError as exc:
            raise ValueError("Image OCR requires the optional ingestion dependencies") from exc
        suffix = ".png" if media_type == "image/png" else ".jpg"
        temporary_path: Path | None = None
        try:
            with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as temporary:
                temporary.write(content)
                temporary_path = Path(temporary.name)
            result = DocumentConverter().convert(temporary_path)
            text = result.document.export_to_markdown()
        finally:
            if temporary_path and temporary_path.exists():
                temporary_path.unlink()
    else:
        text = content.decode("utf-8", errors="replace")
    normalized = "\n".join(line.rstrip() for line in text.replace("\r\n", "\n").split("\n"))
    if not normalized.strip():
        raise ValueError("No extractable text was found")
    return normalized[:500_000]


def extract_document(
    content: bytes,
    media_type: str,
    filename: str,
    settings: Settings,
) -> DocumentExtraction:
    """Extract with the configured Docling service, retaining a safe local text fallback.

    Production configuration requires Docling. Plain text, Markdown, and HTML stay on the local
    deterministic path because OCR/layout inference adds no information to those formats.
    """
    if settings.docling_url and media_type not in {"text/plain", "text/markdown", "text/html"}:
        text, metadata = _docling_extract(content, media_type, filename, settings)
        engine = "docling-serve"
        confidence = float(metadata.pop("confidence"))
        timings = metadata.pop("timings")
        warnings = metadata.pop("warnings")
    else:
        text = extract_text(content, media_type)
        engine = "local-structured-text"
        confidence = 1.0 if media_type.startswith("text/") else 0.7
        timings = {}
        warnings = []
    spans = [
        {"line_start": number, "line_end": number}
        for number, line in enumerate(text.splitlines(), start=1)
        if line.strip()
    ][:5_000]
    return DocumentExtraction(
        text=text,
        engine=engine,
        confidence=confidence,
        spans=spans,
        timings=timings,
        warnings=warnings,
    )


def _docling_extract(
    content: bytes,
    media_type: str,
    filename: str,
    settings: Settings,
) -> tuple[str, dict[str, Any]]:
    """Call the pinned private Docling v1 service using its documented multipart contract."""
    docling_url = settings.docling_url
    if not docling_url:
        raise ValueError("Docling service is not configured")
    headers: dict[str, str] = {}
    if settings.docling_api_key:
        headers["X-Api-Key"] = settings.docling_api_key.get_secret_value()
    response = httpx.post(
        f"{docling_url.rstrip('/')}/v1/convert/file",
        headers=headers,
        files={"files": (filename[:255], content, media_type)},
        data={
            "to_formats": "md",
            "do_ocr": "true",
            "ocr_lang": "en,es",
            "image_export_mode": "placeholder",
            "table_mode": "accurate",
        },
        timeout=settings.docling_timeout_seconds,
    )
    response.raise_for_status()
    payload = response.json()
    status_value = str(payload.get("status", ""))
    if status_value not in {"success", "partial_success"}:
        raise ValueError("Docling conversion failed")
    document = payload.get("document") or {}
    text = str(document.get("md_content") or document.get("text_content") or "")
    normalized = "\n".join(line.rstrip() for line in text.replace("\r\n", "\n").split("\n"))[
        :500_000
    ]
    if not normalized.strip():
        raise ValueError("Docling returned no extractable text")
    errors = payload.get("errors") or []
    warnings = [
        str(item.get("component_type") or item.get("error_message") or "conversion-warning")[:200]
        if isinstance(item, dict)
        else type(item).__name__
        for item in errors[:20]
    ]
    timings = payload.get("timings") if isinstance(payload.get("timings"), dict) else {}
    # Persist only bounded operational timing metadata, never raw remote response bodies.
    safe_timings = json.loads(json.dumps(timings, default=str))
    confidence = 0.92 if status_value == "success" else 0.72
    if media_type.startswith("image/"):
        confidence = min(confidence, 0.82)
    return normalized, {
        "confidence": confidence,
        "timings": safe_timings,
        "warnings": warnings,
    }


def propose_profile_claims(text: str, source_id: str) -> list[dict[str, object]]:
    """Create conservative deterministic claim candidates with exact line locators.

    Rich LLM extraction may add typed proposals later, but this baseline never promotes a sentence
    into canonical data and never obeys instructions embedded in a document.
    """
    proposals: list[dict[str, object]] = []
    for line_number, raw in enumerate(text.splitlines(), start=1):
        line = " ".join(raw.split())
        if len(line) < 12 or len(line) > 500:
            continue
        lower = line.casefold()
        claim_type = (
            "experience"
            if any(key in lower for key in ("experience", "worked", "led", "developed", "engineer"))
            else "profile"
        )
        if any(
            key in lower
            for key in ("skill", "python", "javascript", "sql", "research", "management")
        ):
            claim_type = "skill"
        proposals.append(
            {
                "source_id": source_id,
                "claim_type": claim_type,
                "statement": line,
                "normalized_value": {},
                "source_locator": {"line_start": line_number, "line_end": line_number},
                "confidence": 0.45,
            }
        )
        if len(proposals) >= 80:
            break
    return proposals
