"""Authenticated encryption for delegated OAuth credentials and PKCE verifiers."""

from __future__ import annotations

import base64
import json
import os
from typing import Any

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from careertwin.config import Settings
from careertwin.services.crypto_keys import decode_aes256_key

VERSION = b"CTC1"


def _key(settings: Settings) -> bytes:
    if not settings.connector_encryption_key:
        raise ValueError("Connector encryption is not configured")
    value = settings.connector_encryption_key.get_secret_value()
    return decode_aes256_key(value, "CONNECTOR_ENCRYPTION_KEY")


def seal_json(
    settings: Settings,
    workspace_id: str,
    provider: str,
    purpose: str,
    payload: dict[str, Any],
) -> str:
    """Encrypt one JSON value with tenant/provider/purpose-bound associated data."""
    nonce = os.urandom(12)
    aad = f"{workspace_id}:{provider}:{purpose}".encode()
    plaintext = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode()
    ciphertext = AESGCM(_key(settings)).encrypt(nonce, plaintext, aad)
    return base64.urlsafe_b64encode(VERSION + nonce + ciphertext).decode().rstrip("=")


def open_json(
    settings: Settings,
    workspace_id: str,
    provider: str,
    purpose: str,
    token: str,
) -> dict[str, Any]:
    """Decrypt and validate a connector value without logging key or plaintext material."""
    try:
        raw = base64.urlsafe_b64decode(token + "=" * (-len(token) % 4))
        if not raw.startswith(VERSION):
            raise ValueError("Unsupported connector ciphertext version")
        nonce = raw[len(VERSION) : len(VERSION) + 12]
        ciphertext = raw[len(VERSION) + 12 :]
        aad = f"{workspace_id}:{provider}:{purpose}".encode()
        plaintext = AESGCM(_key(settings)).decrypt(nonce, ciphertext, aad)
        payload = json.loads(plaintext)
    except Exception as exc:
        raise ValueError("Connector credential cannot be decrypted") from exc
    if not isinstance(payload, dict):
        raise ValueError("Connector credential payload is invalid")
    return payload
