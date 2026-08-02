"""Tenant-scoped opaque blob storage with content hashing and traversal prevention."""

from __future__ import annotations

import hashlib
import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class StoredBlob:
    key: str
    sha256: str
    size: int


class FileBlobStore:
    """Filesystem blob provider; keys never contain user filenames or stable personal identifiers."""

    def __init__(self, root: Path) -> None:
        self.root = root.resolve()

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
            temporary.write_bytes(content)
            temporary.replace(destination)
        return StoredBlob(key=relative.as_posix(), sha256=digest, size=len(content))

    def read(self, workspace_id: str, key: str) -> bytes:
        """Read a blob only when the key belongs to the caller's workspace namespace."""
        safe_workspace = workspace_id.replace("-", "")
        candidate = (self.root / key).resolve()
        expected = (self.root / safe_workspace).resolve()
        if expected not in candidate.parents or self.root not in candidate.parents:
            raise PermissionError("Blob key is outside the workspace")
        return candidate.read_bytes()

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
