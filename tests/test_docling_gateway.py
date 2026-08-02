"""Contract tests for the private Docling gateway without loading ML models."""

from __future__ import annotations

from pathlib import Path

from docling_gateway import app as gateway
from fastapi.testclient import TestClient


def test_health_does_not_expose_configuration() -> None:
    response = TestClient(gateway.app).get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "engine": "docling-slim-2.117.0"}


def test_conversion_requires_api_key(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    monkeypatch.setenv("DOCLING_SERVE_API_KEY", "gateway-test-secret")
    response = TestClient(gateway.app).post(
        "/v1/convert/file",
        files={"files": ("resume.pdf", b"%PDF-test", "application/pdf")},
    )
    assert response.status_code == 401


def test_conversion_contract(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    monkeypatch.setenv("DOCLING_SERVE_API_KEY", "gateway-test-secret")
    monkeypatch.setattr(gateway, "_convert_path", lambda *args, **kwargs: "# Resume\nPython")
    response = TestClient(gateway.app).post(
        "/v1/convert/file",
        headers={"X-Api-Key": "gateway-test-secret"},
        files={"files": ("resume.pdf", b"%PDF-test", "application/pdf")},
        data={"to_formats": "md", "do_ocr": "true", "table_mode": "accurate"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "success"
    assert payload["document"]["md_content"].startswith("# Resume")
    assert payload["errors"] == []


def test_container_build_keeps_tables_without_multimedia_backends() -> None:
    repository_root = Path(__file__).parents[1]
    gateway_source = (repository_root / "docling_gateway" / "app.py").read_text()
    dockerfile = (repository_root / "docker" / "docling" / "Dockerfile").read_text()
    requirements = (
        repository_root / "docling_gateway" / "requirements.txt"
    ).read_text()
    dockerignore = (repository_root / ".dockerignore").read_text()
    assert "-DBUILD_LIST=core,imgcodecs,imgproc,python3" in dockerfile
    assert "opencv-python-5.0.0.93-optional-missing-stubs.patch" in dockerfile
    assert "b82f9831daab90b725c7c1ee1b36cb5732c367096ac76d119e64e14eb70d5f3c" in dockerfile
    assert "careertwin-opencv-skbuild" in dockerfile
    opencv_build = dockerfile.split("ARG OPENCV_SOURCE_URL", maxsplit=1)[1]
    assert "--mount=type=cache,id=careertwin-opencv-skbuild" in opencv_build
    assert "!docker/docling/patches/*.patch" in dockerignore
    assert "-DCPU_DISPATCH=" in dockerfile
    for disabled_backend in ("FFMPEG", "GSTREAMER", "V4L", "1394"):
        assert f"-DWITH_{disabled_backend}=OFF" in dockerfile
    assert "InputFormat.IMAGE: PdfFormatOption" in gateway_source
    assert "do_table_structure=True" in gateway_source
    assert "TableFormerMode.ACCURATE" in gateway_source
    assert "EasyOcrOptions" in gateway_source
    assert "feat-ocr-easyocr" in requirements
    assert "opencv-python-headless==5.0.0.93" in requirements
