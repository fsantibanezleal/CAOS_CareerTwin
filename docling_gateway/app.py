"""Authenticated Docling endpoint with the subset of the v1 API CareerTwin consumes."""

from __future__ import annotations

import asyncio
import hmac
import os
import tempfile
import time
from pathlib import Path
from typing import Annotated, Any

from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from starlette.concurrency import run_in_threadpool

MAX_DOCUMENT_BYTES = 25 * 1024 * 1024
ALLOWED_SUFFIXES = {".docx", ".jpeg", ".jpg", ".pdf", ".png"}
_conversion_slot = asyncio.Semaphore(1)

app = FastAPI(
    title="CareerTwin Docling Gateway",
    version="1.0.0",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)


def _require_api_key(candidate: str | None) -> None:
    """Reject missing configuration and compare the caller secret in constant time."""
    expected = os.environ.get("DOCLING_SERVE_API_KEY", "")
    if not expected:
        raise HTTPException(status_code=503, detail="Document conversion is not configured")
    if candidate is None or not hmac.compare_digest(candidate, expected):
        raise HTTPException(status_code=401, detail="Invalid API key")


def _safe_suffix(filename: str | None) -> str:
    """Return a supported suffix without reusing any caller-controlled path component."""
    suffix = Path(filename or "upload").suffix.casefold()
    if suffix not in ALLOWED_SUFFIXES:
        raise HTTPException(status_code=415, detail="Unsupported document type")
    return suffix


def _convert_path(path: Path, *, do_ocr: bool, table_mode: str) -> str:
    """Convert one local file with Docling and return bounded Markdown."""
    from docling.datamodel.base_models import InputFormat  # type: ignore[import-not-found]
    from docling.datamodel.pipeline_options import (  # type: ignore[import-not-found]
        EasyOcrOptions,
        PdfPipelineOptions,
        TableFormerMode,
    )
    from docling.document_converter import (  # type: ignore[import-not-found]
        DocumentConverter,
        PdfFormatOption,
    )

    pipeline = PdfPipelineOptions(do_ocr=do_ocr, do_table_structure=True)
    pipeline.ocr_options = EasyOcrOptions(
        lang=["en", "es"],
        force_full_page_ocr=False,
        use_gpu=False,
        download_enabled=True,
    )
    pipeline.table_structure_options.mode = (
        TableFormerMode.ACCURATE
        if table_mode.casefold() == TableFormerMode.ACCURATE.value
        else TableFormerMode.FAST
    )
    converter = DocumentConverter(
        format_options={
            InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline),
            InputFormat.IMAGE: PdfFormatOption(pipeline_options=pipeline),
        }
    )
    result = converter.convert(path, max_num_pages=300, max_file_size=MAX_DOCUMENT_BYTES)
    markdown = str(result.document.export_to_markdown()).strip()
    if not markdown:
        raise ValueError("conversion produced no text")
    return markdown[:500_000]


@app.get("/health")
def health() -> dict[str, str]:
    """Report process health without exposing conversion or configuration details."""
    return {"status": "ok", "engine": "docling-slim-2.117.0"}


@app.post("/v1/convert/file")
async def convert_file(
    files: Annotated[list[UploadFile], File()],
    to_formats: Annotated[str, Form()] = "md",
    do_ocr: Annotated[bool, Form()] = True,
    ocr_lang: Annotated[str, Form()] = "en,es",
    image_export_mode: Annotated[str, Form()] = "placeholder",
    table_mode: Annotated[str, Form()] = "accurate",
    x_api_key: Annotated[str | None, Header(alias="X-Api-Key")] = None,
) -> dict[str, Any]:
    """Convert exactly one bounded file and return the Docling v1 fields used by CareerTwin."""
    del ocr_lang, image_export_mode
    _require_api_key(x_api_key)
    if len(files) != 1:
        raise HTTPException(status_code=422, detail="Exactly one document is required")
    if to_formats.casefold() != "md":
        raise HTTPException(status_code=422, detail="Only Markdown output is supported")

    upload = files[0]
    suffix = _safe_suffix(upload.filename)
    content = await upload.read(MAX_DOCUMENT_BYTES + 1)
    await upload.close()
    if not content:
        raise HTTPException(status_code=422, detail="The document is empty")
    if len(content) > MAX_DOCUMENT_BYTES:
        raise HTTPException(status_code=413, detail="The document exceeds 25 MiB")

    temporary_path: Path | None = None
    started = time.perf_counter()
    try:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as temporary:
            temporary.write(content)
            temporary_path = Path(temporary.name)
        async with _conversion_slot:
            markdown = await run_in_threadpool(
                _convert_path,
                temporary_path,
                do_ocr=do_ocr,
                table_mode=table_mode,
            )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=422, detail="Document conversion failed") from exc
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)

    return {
        "status": "success",
        "document": {"md_content": markdown},
        "errors": [],
        "timings": {"total_seconds": round(time.perf_counter() - started, 4)},
    }
