"""The lockfile must only ever declare the project's own version at its two root keys.

A release bump that string-replaced the old version across `frontend/package-lock.json`
also rewrote unrelated dependency versions: `decimal.js` moved from 10.6.0 to a
10.6.1 that does not exist, and `@fasl-work/caos-app-shell` moved to a version whose
integrity hash no longer matched. Both failures only surfaced during the container
build, as `npm ci` 404s, after the release had already been tagged.

These tests make the same mistake fail locally instead.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
LOCK = REPO_ROOT / "frontend" / "package-lock.json"
PACKAGE = REPO_ROOT / "frontend" / "package.json"


def _version() -> str:
    return (REPO_ROOT / "VERSION").read_text(encoding="utf-8").strip()


def _lock() -> dict:
    return json.loads(LOCK.read_text(encoding="utf-8"))


def test_lock_root_versions_match_version_file() -> None:
    """Both root version keys equal VERSION."""
    expected = _version()
    lock = _lock()
    assert lock.get("version") == expected
    assert lock.get("packages", {}).get("", {}).get("version") == expected


def test_package_json_matches_lock() -> None:
    """package.json and the lockfile never disagree; npm ci fails when they do."""
    package = json.loads(PACKAGE.read_text(encoding="utf-8"))
    assert package["version"] == _lock().get("version")


def test_no_dependency_carries_the_project_version() -> None:
    """No dependency entry was collaterally rewritten to the project version.

    Only the two root keys may hold it. A resolved URL or a dependency range that
    contains the project version is the fingerprint of a blanket string replace.
    """
    expected = _version()
    lock = _lock()
    offenders: list[str] = []
    for name, entry in (lock.get("packages") or {}).items():
        if name == "":
            continue
        if entry.get("version") == expected:
            offenders.append(f"{name} version=={expected}")
        resolved = entry.get("resolved") or ""
        if expected in resolved:
            offenders.append(f"{name} resolved contains {expected}: {resolved}")
    assert not offenders, (
        "Dependency entries carry the project version, which means a version bump "
        "string-replaced the lockfile instead of editing its root keys:\n  "
        + "\n  ".join(offenders)
    )


def test_every_resolved_url_matches_its_declared_version() -> None:
    """A tarball URL must contain the version the entry declares.

    This is what actually broke the build: the entry said 10.6.0 in one place and the
    URL pointed at a 10.6.1 tarball that was never published.
    """
    mismatches: list[str] = []
    for name, entry in (_lock().get("packages") or {}).items():
        version = entry.get("version")
        resolved = entry.get("resolved") or ""
        if not version or not resolved or "registry.npmjs.org" not in resolved:
            continue
        tail = resolved.rsplit("/", 1)[-1]
        if not re.search(re.escape(version) + r"\.tgz$", tail):
            mismatches.append(f"{name}: version {version} but tarball {tail}")
    assert not mismatches, "Lockfile tarball URLs disagree with declared versions:\n  " + "\n  ".join(mismatches)
