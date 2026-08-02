"""Configuration parsing and fail-closed production contracts."""

from __future__ import annotations

from pathlib import Path

import pytest
from pydantic import ValidationError

from careertwin.config import Settings


def test_local_model_defaults_are_resource_bounded() -> None:
    settings = Settings(_env_file=None)
    assert settings.ollama_model == "qwen2.5:0.5b-instruct-q4_K_M"
    assert settings.llm_context_window == 4096
    assert settings.llm_max_output_tokens == 1024
    assert settings.llm_request_timeout_seconds == 300


def settings_from_environment(monkeypatch: pytest.MonkeyPatch, origins: str) -> Settings:
    """Build isolated settings with only the supplied origin representation."""
    monkeypatch.setenv("ALLOWED_ORIGINS", origins)
    return Settings(_env_file=None)


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        (
            "https://careertwin.example, http://localhost:5173/",
            ["https://careertwin.example", "http://localhost:5173"],
        ),
        (
            '["https://careertwin.example","http://localhost:5173"]',
            ["https://careertwin.example", "http://localhost:5173"],
        ),
    ],
)
def test_allowed_origins_accept_documented_environment_formats(
    monkeypatch: pytest.MonkeyPatch, raw: str, expected: list[str]
) -> None:
    """Comma-separated and JSON environment forms must have identical semantics."""
    assert settings_from_environment(monkeypatch, raw).allowed_origins == expected


def test_allowed_origins_deduplicate_after_normalization(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Equivalent origins must not create duplicate CORS entries."""
    settings = settings_from_environment(
        monkeypatch,
        '["https://careertwin.example/","https://careertwin.example"]',
    )
    assert settings.allowed_origins == ["https://careertwin.example"]


@pytest.mark.parametrize(
    "raw",
    [
        "*",
        "careertwin.example",
        "ftp://careertwin.example",
        "https://careertwin.example/profile",
        '["https://careertwin.example", 42]',
        "[]",
        "[invalid-json]",
    ],
)
def test_allowed_origins_reject_ambiguous_or_unsafe_values(
    monkeypatch: pytest.MonkeyPatch, raw: str
) -> None:
    """Credentialed CORS must never accept wildcards, paths, or malformed entries."""
    with pytest.raises(ValidationError, match="ALLOWED_ORIGINS"):
        settings_from_environment(monkeypatch, raw)


def test_production_settings_keep_fail_closed_secret_checks(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The custom origin decoder must not bypass production safety validation."""
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://user:pass@db/careertwin")
    monkeypatch.setenv("SECURE_COOKIES", "true")
    monkeypatch.setenv("APP_SECRET_KEY", "development-secret-change-me")
    monkeypatch.setenv("APP_CSRF_SECRET", "private-test-csrf-secret")
    monkeypatch.setenv("ALLOWED_ORIGINS", "https://careertwin.example")

    with pytest.raises(ValidationError, match="APP_SECRET_KEY"):
        Settings(_env_file=None)


def test_backup_entrypoints_enforce_owner_only_storage() -> None:
    """Keep private backups safe and independent from tools absent in the app image."""
    root = Path(__file__).resolve().parents[1]
    shell = (root / "scripts" / "backup.sh").read_text(encoding="utf-8")
    powershell = (root / "scripts" / "backup.ps1").read_text(encoding="utf-8")

    assert "umask 077" in shell
    assert 'chmod 700 "$BACKUP_ROOT"' in shell
    assert 'chmod 600 "$DATABASE_FILE" "$BLOB_FILE"' in shell
    assert "/inheritance:r" in powershell
    assert "$($env:USERNAME):F" in powershell
    assert "docker compose cp app:/var/lib/careertwin/blobs" in shell
    assert "docker compose cp 'app:/var/lib/careertwin/blobs'" in powershell
    assert "docker compose exec -T app tar" not in shell
    assert "docker compose exec -T app rm" not in shell
    assert "docker compose exec -T app tar" not in powershell
    assert "docker compose exec -T app rm" not in powershell
