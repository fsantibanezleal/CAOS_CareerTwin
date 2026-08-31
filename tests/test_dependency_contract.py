"""Packaging contracts shared by local installation and the runtime container."""

from __future__ import annotations

import json
import tomllib
from pathlib import Path

from careertwin import __version__


def test_canonical_release_versions_match() -> None:
    """Keep every independently consumed release surface on one exact version."""
    root = Path(__file__).resolve().parents[1]
    canonical = (root / "VERSION").read_text(encoding="utf-8").strip()
    project = tomllib.loads((root / "pyproject.toml").read_text(encoding="utf-8"))
    frontend = json.loads((root / "frontend/package.json").read_text(encoding="utf-8"))
    extension = json.loads((root / "extension/manifest.json").read_text(encoding="utf-8"))

    assert {
        project["project"]["version"],
        __version__,
        frontend["version"],
        extension["version"],
    } == {canonical}
    assert f"## [{canonical}]" in (root / "CHANGELOG.md").read_text(encoding="utf-8")
    assert f"`{canonical}`" in (root / "README.md").read_text(encoding="utf-8")


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


def test_powershell_bootstrap_keeps_optional_arguments_as_an_array() -> None:
    """Prevent PowerShell from splatting a single CLI argument one character at a time."""
    root = Path(__file__).resolve().parents[1]
    script = (root / "scripts/bootstrap-superuser.ps1").read_text(encoding="utf-8")

    assert "[string[]]$PasswordPolicyArgs = @()" in script
    assert "$PasswordPolicyArgs += '--no-force-change'" in script
    assert "$PasswordPolicyArgs = if" not in script


def test_native_launchers_use_collision_safe_configurable_ports() -> None:
    """Keep native background launch reliable across concurrent local worktrees."""
    root = Path(__file__).resolve().parents[1]
    powershell = (root / "scripts/dev.ps1").read_text(encoding="utf-8")
    posix = (root / "scripts/dev.sh").read_text(encoding="utf-8")
    vite = (root / "frontend/vite.config.ts").read_text(encoding="utf-8")

    assert "--reload" not in powershell
    assert "--reload" not in posix
    assert "-ApiPort/-WebPort" in powershell
    assert "CAREERTWIN_API_PORT" in powershell
    assert "CAREERTWIN_API_PORT" in posix
    assert "CAREERTWIN_API_PORT" in vite
