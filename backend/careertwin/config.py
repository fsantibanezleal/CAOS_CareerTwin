"""Environment-only application configuration with production safety checks."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal
from urllib.parse import urlsplit

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime settings loaded from environment variables and an ignored local `.env`."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)

    app_env: Literal["development", "test", "production"] = "development"
    app_host: str = "127.0.0.1"
    app_port: int = 8000
    app_public_url: str = "http://localhost:8000"
    app_secret_key: SecretStr = SecretStr("development-secret-change-me")
    app_csrf_secret: SecretStr = SecretStr("development-csrf-change-me")
    database_url: str = "sqlite:///./data/private/careertwin.sqlite3"
    redis_url: str = "redis://localhost:6379/0"
    blob_root: Path = Path("./data/blobs")
    allowed_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["http://localhost:5173", "http://localhost:8000"]
    )
    secure_cookies: bool = False
    trusted_proxy_count: int = 0
    session_hours: int = Field(default=12, ge=1, le=720)
    max_upload_bytes: int = Field(default=15 * 1024 * 1024, ge=1024, le=100 * 1024 * 1024)
    max_url_bytes: int = Field(default=2 * 1024 * 1024, ge=1024, le=10 * 1024 * 1024)
    llm_default_provider: str = "ollama"
    xai_api_key: SecretStr | None = None
    openai_api_key: SecretStr | None = None
    anthropic_api_key: SecretStr | None = None
    google_api_key: SecretStr | None = None
    ollama_base_url: str | None = "http://localhost:11434"
    ollama_model: str = "qwen2.5:0.5b-instruct-q4_K_M"
    ollama_embedding_model: str = "embeddinggemma:300m"
    llm_request_timeout_seconds: int = Field(default=300, ge=10, le=900)
    llm_context_window: int = Field(default=4096, ge=2048, le=32768)
    llm_max_output_tokens: int = Field(default=1024, ge=128, le=8192)
    semantic_matching_enabled: bool = True
    blob_encryption_key: SecretStr | None = None
    blob_encryption_key_id: str = Field(default="local-v1", min_length=1, max_length=64)
    connector_encryption_key: SecretStr | None = None
    docling_url: str | None = None
    docling_api_key: SecretStr | None = None
    docling_timeout_seconds: int = Field(default=300, ge=30, le=1800)
    google_oauth_client_id: str | None = None
    google_oauth_client_secret: SecretStr | None = None
    microsoft_oauth_client_id: str | None = None
    microsoft_oauth_client_secret: SecretStr | None = None
    microsoft_oauth_tenant: str = "common"
    connector_sync_timeout_seconds: int = Field(default=30, ge=10, le=180)
    email_retention_days: int = Field(default=365, ge=30, le=730)
    worker_max_jobs: int = Field(default=2, ge=1, le=32)
    langfuse_public_key: str | None = None
    langfuse_secret_key: SecretStr | None = None
    langfuse_host: str | None = None
    clamav_host: str | None = None
    clamav_port: int = 3310

    @field_validator("allowed_origins", mode="before")
    @classmethod
    def split_origins(cls, value: object) -> object:
        """Parse, normalize, and validate explicit HTTP(S) CORS origins.

        ``NoDecode`` keeps environment strings intact until this validator runs. This avoids
        Pydantic Settings attempting JSON decoding before the documented comma-separated form can
        be handled. JSON arrays remain supported for Compose and hosted deployments.
        """
        parsed: object = value
        if isinstance(value, str):
            raw = value.strip()
            if raw.startswith("["):
                try:
                    parsed = json.loads(raw)
                except json.JSONDecodeError as exc:
                    raise ValueError("ALLOWED_ORIGINS contains invalid JSON") from exc
            else:
                parsed = [part.strip() for part in raw.split(",") if part.strip()]

        if not isinstance(parsed, (list, tuple, set)) or not parsed:
            raise ValueError("ALLOWED_ORIGINS must contain at least one origin")

        origins: list[str] = []
        for candidate in parsed:
            if not isinstance(candidate, str):
                raise ValueError("Every ALLOWED_ORIGINS entry must be a string")
            origin = candidate.strip().rstrip("/")
            parts = urlsplit(origin)
            if (
                origin == "*"
                or parts.scheme not in {"http", "https"}
                or not parts.hostname
                or parts.username is not None
                or parts.password is not None
                or parts.path
                or parts.query
                or parts.fragment
            ):
                raise ValueError(
                    "ALLOWED_ORIGINS entries must be explicit HTTP(S) origins without paths"
                )
            if origin not in origins:
                origins.append(origin)
        return origins

    @model_validator(mode="after")
    def validate_production_secrets(self) -> Settings:
        """Reject known development secrets and insecure cookies in production."""
        if self.app_env != "production":
            return self
        forbidden = {"", "development-secret-change-me", "development-csrf-change-me"}
        if self.app_secret_key.get_secret_value() in forbidden:
            raise ValueError("APP_SECRET_KEY must be a private high-entropy production value")
        if self.app_csrf_secret.get_secret_value() in forbidden:
            raise ValueError("APP_CSRF_SECRET must be a private high-entropy production value")
        if not self.secure_cookies:
            raise ValueError("SECURE_COOKIES must be true in production")
        if not self.database_url.startswith("postgresql+"):
            raise ValueError("Production requires PostgreSQL")
        if self.llm_default_provider in {"mock", "contract", "test"}:
            raise ValueError("Production requires a real model provider")
        configured = {
            "xai": bool(self.xai_api_key),
            "openai": bool(self.openai_api_key),
            "anthropic": bool(self.anthropic_api_key),
            "google": bool(self.google_api_key),
            "ollama": bool(self.ollama_base_url),
        }
        if not configured.get(self.llm_default_provider, False):
            raise ValueError("LLM_DEFAULT_PROVIDER is not configured")
        if self.blob_encryption_key is None:
            raise ValueError("BLOB_ENCRYPTION_KEY is required in production")
        if self.connector_encryption_key is None:
            raise ValueError("CONNECTOR_ENCRYPTION_KEY is required in production")
        if not self.docling_url:
            raise ValueError("DOCLING_URL is required in production")
        return self


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return the process-wide validated settings object."""
    return Settings()
