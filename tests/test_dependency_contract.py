"""Packaging contracts shared by local installation and the runtime container."""

from __future__ import annotations

import tomllib
from pathlib import Path


def test_runtime_requirements_match_project_dependencies_exactly() -> None:
    """Prevent the cache-friendly Docker requirements file from drifting from PyPI metadata."""
    root = Path(__file__).resolve().parents[1]
    project = tomllib.loads((root / "pyproject.toml").read_text(encoding="utf-8"))
    expected = set(project["project"]["dependencies"])
    actual = {
        line.strip()
        for line in (root / "requirements.txt").read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.lstrip().startswith("#")
    }
    assert actual == expected
