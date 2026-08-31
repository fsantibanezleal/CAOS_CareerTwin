"""Tenant-scoped encrypted blob storage with content hashing and traversal prevention."""

from __future__ import annotations

import hashlib
import os
from dataclasses import dataclass
from pathlib import Path

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from careertwin.config import Settings
from careertwin.services.crypto_keys import decode_aes256_key

MAGIC = b"CTB1"
NONCE_BYTES = 12


@dataclass(frozen=True)
class StoredBlob:
    key: str
    sha256: str
    size: int


class FileBlobStore:
    """Filesystem blob provider; keys never contain user filenames or stable personal identifiers."""

    def __init__(
        self, root: Path, encryption_key: str | None = None, key_id: str = "local-v1"
    ) -> None:
        self.root = root.resolve()
        self.key_id = key_id
        self.key = self._decode_key(encryption_key) if encryption_key else None

    @staticmethod
    def _decode_key(value: str) -> bytes:
        """Decode one URL-safe base64 AES-256 key and reject ambiguous key material."""
        return decode_aes256_key(value, "BLOB_ENCRYPTION_KEY")

    def _seal(self, workspace_id: str, key: str, content: bytes) -> bytes:
        if self.key is None:
            return content
        key_id = self.key_id.encode("utf-8")
        if len(key_id) > 255:
            raise ValueError("Blob key identifier is too long")
        nonce = os.urandom(NONCE_BYTES)
        aad = f"{workspace_id.replace('-', '')}:{key}:{self.key_id}".encode()
        ciphertext = AESGCM(self.key).encrypt(nonce, content, aad)
        return MAGIC + bytes([len(key_id)]) + key_id + nonce + ciphertext

    def _open(self, workspace_id: str, key: str, payload: bytes) -> bytes:
        if not payload.startswith(MAGIC):
            return payload
        if self.key is None:
            raise ValueError("Encrypted blob requires BLOB_ENCRYPTION_KEY")
        key_id_length = payload[len(MAGIC)]
        start = len(MAGIC) + 1
        key_id = payload[start : start + key_id_length].decode("utf-8")
        nonce_start = start + key_id_length
        nonce = payload[nonce_start : nonce_start + NONCE_BYTES]
        ciphertext = payload[nonce_start + NONCE_BYTES :]
        if key_id != self.key_id:
            raise ValueError(f"Blob uses unavailable encryption key id: {key_id}")
        aad = f"{workspace_id.replace('-', '')}:{key}:{key_id}".encode()
        return AESGCM(self.key).decrypt(nonce, ciphertext, aad)

    def put(self, workspace_id: str, content: bytes) -> StoredBlob:
        """Persist bytes atomically below a workspace namespace and return an opaque key."""
        digest = hashlib.sha256(content).hexdigest()
        safe_workspace = workspace_id.replace("-", "")
        relative = Path(safe_workspace) / digest[:2] / digest[2:4] / digest
        destination = (self.root / relative).resolve()
        if self.root not in destination.parents:
            raise ValueError("Invalid blob destination")
        destination.parent.mkdir(parents=True, exist_ok=True)
        if not destination.exists():
            temporary = destination.with_suffix(f".{os.getpid()}.tmp")
            temporary.write_bytes(self._seal(workspace_id, relative.as_posix(), content))
            temporary.replace(destination)
        return StoredBlob(key=relative.as_posix(), sha256=digest, size=len(content))

    def read(self, workspace_id: str, key: str) -> bytes:
        """Read a blob only when the key belongs to the caller's workspace namespace."""
        safe_workspace = workspace_id.replace("-", "")
        candidate = (self.root / key).resolve()
        expected = (self.root / safe_workspace).resolve()
        if expected not in candidate.parents or self.root not in candidate.parents:
            raise PermissionError("Blob key is outside the workspace")
        return self._open(workspace_id, key, candidate.read_bytes())

    def encrypt_existing(self) -> dict[str, int]:
        """Encrypt legacy plaintext blobs in place without changing their opaque content keys."""
        if self.key is None:
            raise ValueError("BLOB_ENCRYPTION_KEY is required for migration")
        migrated = 0
        already_encrypted = 0
        candidates = self.root.rglob("*") if self.root.exists() else []
        for candidate in candidates:
            if not candidate.is_file() or candidate.is_symlink() or candidate.suffix == ".tmp":
                continue
            payload = candidate.read_bytes()
            if payload.startswith(MAGIC):
                already_encrypted += 1
                continue
            relative = candidate.relative_to(self.root).as_posix()
            workspace_id = candidate.relative_to(self.root).parts[0]
            temporary = candidate.with_suffix(f".{os.getpid()}.tmp")
            temporary.write_bytes(self._seal(workspace_id, relative, payload))
            temporary.replace(candidate)
            migrated += 1
        return {"migrated": migrated, "already_encrypted": already_encrypted}

    def delete_workspace(self, workspace_id: str) -> None:
        """Permanently remove one workspace tree without following links."""
        safe_workspace = workspace_id.replace("-", "")
        directory = (self.root / safe_workspace).resolve()
        if directory.parent != self.root or not directory.exists():
            return
        for path in sorted(directory.rglob("*"), reverse=True):
            if path.is_symlink():
                path.unlink()
            elif path.is_file():
                path.unlink()
            elif path.is_dir():
                path.rmdir()
        directory.rmdir()


def configured_blob_store(settings: Settings) -> FileBlobStore:
    """Build the blob provider from validated environment-only key material."""
    key = settings.blob_encryption_key.get_secret_value() if settings.blob_encryption_key else None
    return FileBlobStore(settings.blob_root, key, settings.blob_encryption_key_id)
