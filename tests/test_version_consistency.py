"""Every version declaration in the repository must agree with VERSION.

A release that bumps some declarations and not others ships an image that reports
the wrong version from /api/health/ready, which is what happened when v0.5.11 was
built from a tree whose ``careertwin.__version__`` still read 0.5.10. The health
endpoint is the artifact operators trust to tell them what is running, so a
mismatch is a correctness defect, not a cosmetic one.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[1]


def _expected() -> str:
    return (REPO_ROOT / "VERSION").read_text(encoding="utf-8").strip()


def _python_package_version() -> str:
    text = (REPO_ROOT / "backend" / "careertwin" / "__init__.py").read_text(encoding="utf-8")
    match = re.search(r'^__version__\s*=\s*"([^"]+)"', text, re.MULTILINE)
    assert match, "careertwin.__version__ is not declared as a simple string literal"
    return match.group(1)


def _pyproject_version() -> str:
    text = (REPO_ROOT / "pyproject.toml").read_text(encoding="utf-8")
    match = re.search(r'^version\s*=\s*"([^"]+)"', text, re.MULTILINE)
    assert match, "pyproject.toml does not declare a version"
    return match.group(1)


def _json_version(relative: str) -> str:
    return json.loads((REPO_ROOT / relative).read_text(encoding="utf-8"))["version"]


DECLARATIONS = {
    "backend/careertwin/__init__.py": _python_package_version,
    "pyproject.toml": _pyproject_version,
    "frontend/package.json": lambda: _json_version("frontend/package.json"),
    "frontend/package-lock.json": lambda: _json_version("frontend/package-lock.json"),
    "extension/manifest.json": lambda: _json_version("extension/manifest.json"),
}


@pytest.mark.parametrize("source", sorted(DECLARATIONS))
def test_declaration_matches_version_file(source: str) -> None:
    """Each declared version equals the contents of VERSION."""
    expected = _expected()
    actual = DECLARATIONS[source]()
    assert actual == expected, (
        f"{source} declares {actual!r} but VERSION is {expected!r}. "
        "Bump every declaration together; a partial bump ships an image that "
        "misreports its version from /api/health/ready."
    )


def test_version_file_is_semver() -> None:
    """VERSION is a plain semantic version with no prefix or suffix."""
    expected = _expected()
    assert re.fullmatch(r"\d+\.\d+\.\d+", expected), (
        f"VERSION must be bare semver, got {expected!r}"
    )


def test_changelog_documents_the_current_version() -> None:
    """The changelog has a released section for the current VERSION."""
    expected = _expected()
    changelog = (REPO_ROOT / "CHANGELOG.md").read_text(encoding="utf-8")
    assert f"## [{expected}]" in changelog, (
        f"CHANGELOG.md has no '## [{expected}]' section. Every release documents itself."
    )
