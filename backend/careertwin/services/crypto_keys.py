"""Strict decoding for environment-only AES-256 keys."""

from __future__ import annotations

import base64
import re

_URLSAFE_AES256 = re.compile(r"[A-Za-z0-9_-]{43}=?\Z")


def decode_aes256_key(value: str, environment_name: str) -> bytes:
    """Decode one canonical padded or unpadded URL-safe base64 256-bit key."""
    if not _URLSAFE_AES256.fullmatch(value):
        raise ValueError(
            f"{environment_name} must be a canonical URL-safe base64 AES-256 key"
        )
    try:
        raw = base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))
    except (ValueError, TypeError) as exc:
        raise ValueError(f"{environment_name} must be URL-safe base64") from exc
    if len(raw) != 32:
        raise ValueError(f"{environment_name} must decode to exactly 32 bytes")
    canonical = base64.urlsafe_b64encode(raw).decode().rstrip("=")
    if value.rstrip("=") != canonical:
        raise ValueError(f"{environment_name} must use canonical URL-safe base64 encoding")
    return raw
