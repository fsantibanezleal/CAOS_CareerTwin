"""Bounded document inspection, malware scanning and text extraction."""

from __future__ import annotations

import base64
import io
import socket
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
        raise ValueError("Image transcription requires the configured external xAI provider")
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
    """Extract deterministically, using xAI only when image or scanned-PDF vision is required.

    CareerTwin never starts a document or OCR model. Private binary content is sent to xAI only
    when the operator configured ``XAI_API_KEY``; uploaded xAI files are deleted in ``finally``.
    """
    try:
        text = extract_text(content, media_type)
        engine = "deterministic-structured-text"
        confidence = 1.0 if media_type.startswith("text/") else 0.8
    except ValueError:
        if not settings.xai_api_key or media_type not in {"application/pdf", "image/jpeg", "image/png"}:
            raise
        text = _xai_document_text(content, media_type, filename, settings)
        engine = "xai-document-understanding"
        confidence = 0.78
    timings: dict[str, Any] = {}
    warnings: list[str] = []
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


def _xai_output_text(payload: dict[str, Any]) -> str:
    """Extract visible text from a Responses API payload without retaining provider internals."""
    parts: list[str] = []
    for output in payload.get("output", []):
        if not isinstance(output, dict):
            continue
        for content in output.get("content", []):
            if isinstance(content, dict) and isinstance(content.get("text"), str):
                parts.append(content["text"])
    text = "\n".join(parts).strip()
    if not text:
        raise ValueError("xAI returned no document text")
    return text[:500_000]


def _xai_document_text(
    content: bytes,
    media_type: str,
    filename: str,
    settings: Settings,
) -> str:
    """Transcribe an image or scanned PDF through xAI with bounded transient retention."""
    if not settings.xai_api_key:
        raise ValueError("xAI document understanding is not configured")
    authorization = {"Authorization": f"Bearer {settings.xai_api_key.get_secret_value()}"}
    base_url = settings.xai_base_url.rstrip("/")
    input_item: dict[str, str]
    remote_file_id: str | None = None
    if media_type.startswith("image/"):
        encoded = base64.b64encode(content).decode("ascii")
        input_item = {
            "type": "input_image",
            "image_url": f"data:{media_type};base64,{encoded}",
        }
    else:
        upload = httpx.post(
            f"{base_url}/files",
            headers=authorization,
            data={"expires_after": '{"anchor":"created_at","seconds":3600}'},
            files={"file": (filename[:255], content, media_type)},
            timeout=settings.llm_request_timeout_seconds,
        )
        upload.raise_for_status()
        remote_file_id = str(upload.json().get("id") or "")
        if not remote_file_id:
            raise ValueError("xAI file upload returned no identifier")
        input_item = {"type": "input_file", "file_id": remote_file_id}
    try:
        response = httpx.post(
            f"{base_url}/responses",
            headers={**authorization, "Content-Type": "application/json"},
            json={
                "model": settings.xai_model,
                "store": False,
                "input": [{
                    "role": "user",
                    "content": [
                        input_item,
                        {
                            "type": "input_text",
                            "text": (
                                "Transcribe this professional document faithfully in reading order. "
                                "Preserve headings, lists, tables, dates, employers, roles, skills, "
                                "education and measurable outcomes. Return document text only."
                            ),
                        },
                    ],
                }],
            },
            timeout=settings.llm_request_timeout_seconds,
        )
        response.raise_for_status()
        return _xai_output_text(response.json())
    finally:
        if remote_file_id:
            try:
                httpx.delete(
                    f"{base_url}/files/{remote_file_id}",
                    headers=authorization,
                    timeout=30,
                )
            except httpx.HTTPError:
                pass


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
