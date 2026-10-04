"""Adversarial retention contracts without a Docker daemon or production mutation."""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path
from types import ModuleType

import pytest


@pytest.fixture
def tool(monkeypatch: pytest.MonkeyPatch) -> ModuleType:
    path = Path(__file__).resolve().parents[1] / "scripts" / "vps-images.py"
    spec = importlib.util.spec_from_file_location("vps_images", path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    if not hasattr(module.os, "getuid"):
        monkeypatch.setattr(module.os, "getuid", lambda: 0, raising=False)
    monkeypatch.setattr(module, "disk", lambda _repo: {"free_bytes": 20 * 1024**3})
    monkeypatch.setattr(module, "readiness", lambda _url, _tag: {"status": "ok"})
    monkeypatch.setattr(
        module, "command", lambda *args: "commit" if "rev-parse" in args else "migration"
    )
    return module


@pytest.fixture
def snapshot() -> dict:
    images = {
        f"{name}:v0.14.{patch}": f"{name}-{patch}"
        for name in ("careertwin-app", "careertwin-db")
        for patch in range(2, 6)
    }
    images["careertwin-app:candidate"] = "candidate"
    images["unrelated:old"] = "unrelated"
    containers = [
        {"name": name, "running": True, "ref": f"{repo}:v0.14.5", "image": f"{repo}-5", "id": name}
        for name, repo in (
            ("careertwin-app-1", "careertwin-app"),
            ("careertwin-worker-1", "careertwin-app"),
            ("careertwin-db-1", "careertwin-db"),
        )
    ]
    return {"images": images, "containers": containers}


def manifest(tool: ModuleType, snapshot: dict) -> dict:
    return tool.checkpoint(Path("."), snapshot, ["v0.14.4", "v0.14.3"], "unused")


def test_plan_preserves_three_pairs_and_unrelated_images(tool: ModuleType, snapshot: dict) -> None:
    result = tool.plan(Path("."), snapshot, manifest(tool, snapshot))
    assert set(result["remove_tags"]) == {
        "careertwin-app:v0.14.2",
        "careertwin-db:v0.14.2",
        "careertwin-app:candidate",
    }
    assert result["retained_releases"] == ["v0.14.5", "v0.14.4", "v0.14.3"]


def test_stopped_container_and_image_alias_are_protected(tool: ModuleType, snapshot: dict) -> None:
    snapshot["containers"].append(
        {
            "name": "other",
            "running": False,
            "ref": "careertwin-app:v0.14.2",
            "image": "careertwin-app-2",
            "id": "other",
        }
    )
    snapshot["images"]["careertwin-app:alias"] = "careertwin-app-2"
    result = tool.plan(Path("."), snapshot, manifest(tool, snapshot))
    assert "careertwin-app:v0.14.2" not in result["remove_tags"]
    assert "careertwin-app:alias" not in result["remove_tags"]


@pytest.mark.parametrize(
    "pins",
    [[], ["v0.14.4"], ["v0.14.4", "v0.14.4"], ["v0.14.5", "v0.14.4"], ["candidate", "v0.14.3"]],
)
def test_invalid_pins_fail_closed(tool: ModuleType, snapshot: dict, pins: list[str]) -> None:
    with pytest.raises(RuntimeError):
        tool.checkpoint(Path("."), snapshot, pins, "unused")


def test_missing_pair_and_changed_identity_fail_closed(tool: ModuleType, snapshot: dict) -> None:
    pinned = manifest(tool, snapshot)
    snapshot["images"]["careertwin-app:v0.14.4"] = "replaced"
    with pytest.raises(RuntimeError, match="identity changed"):
        tool.plan(Path("."), snapshot, pinned)
    del snapshot["images"]["careertwin-db:v0.14.4"]
    with pytest.raises(RuntimeError, match="incomplete"):
        tool.plan(Path("."), snapshot, pinned)


def test_migration_drift_blocks_checkpoint(
    tool: ModuleType, snapshot: dict, monkeypatch: pytest.MonkeyPatch
) -> None:
    def command(*args: str) -> str:
        if "rev-parse" in args:
            return args[-1]
        return "new" if "refs/tags/v0.14.5^{commit}" in args else "old"

    monkeypatch.setattr(tool, "command", command)
    with pytest.raises(RuntimeError, match="migration tree"):
        manifest(tool, snapshot)


@pytest.mark.parametrize("change", ["stopped", "mixed"])
def test_unhealthy_or_mixed_runtime_blocks_cleanup(
    tool: ModuleType, snapshot: dict, change: str
) -> None:
    if change == "stopped":
        snapshot["containers"][0]["running"] = False
    else:
        snapshot["containers"][0]["ref"] = "careertwin-app:v0.14.4"
    with pytest.raises(RuntimeError):
        manifest(tool, snapshot)


def test_rotation_preserves_previous_current_and_newest_pin(
    tool: ModuleType, snapshot: dict
) -> None:
    previous = manifest(tool, snapshot)
    for container in snapshot["containers"]:
        repo = container["ref"].split(":")[0]
        container["ref"] = repo + ":v0.14.6"
        container["image"] = repo + "-6"
        snapshot["images"][container["ref"]] = repo + "-6"
    assert tool.rotate_pins(snapshot, previous) == ["v0.14.5", "v0.14.4"]


def test_retagged_running_image_is_not_accepted(tool: ModuleType, snapshot: dict) -> None:
    snapshot["images"]["careertwin-app:v0.14.5"] = "rebuilt"
    with pytest.raises(RuntimeError, match="identity differs"):
        manifest(tool, snapshot)


def test_apply_stops_before_deletion_on_inventory_race(
    tool: ModuleType, snapshot: dict, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    pinned = manifest(tool, snapshot)
    monkeypatch.setattr(tool, "inventory", lambda: {"images": {}, "containers": []})
    with pytest.raises(RuntimeError, match="inventory changed"):
        tool.apply_cleanup(Path("."), tmp_path, snapshot, pinned, "unused", False)
    assert not (tmp_path / "last-cleanup.json").exists()


def test_apply_removes_only_exact_tags_and_bounds_cache(
    tool: ModuleType, snapshot: dict, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    pinned = manifest(tool, snapshot)
    commands = []
    monkeypatch.setattr(tool, "inventory", lambda: snapshot)
    original = tool.command

    def command(*args: str) -> str:
        commands.append(args)
        if args[:3] == ("docker", "image", "rm"):
            del snapshot["images"][args[3]]
            return "removed"
        return original(*args)

    monkeypatch.setattr(tool, "command", command)
    result = tool.apply_cleanup(Path("."), tmp_path, snapshot, pinned, "unused", True)
    assert result["completed"]
    assert len(result["removed_tags"]) == 3
    assert (
        "docker",
        "buildx",
        "--builder",
        "default",
        "prune",
        "--force",
        "--max-used-space",
        "2GB",
    ) in commands
    assert not any(
        "volume" in args or "system" in args or "--force" in args[3:]
        for args in commands
        if args[:3] == ("docker", "image", "rm")
    )


@pytest.mark.parametrize(
    "url",
    [
        "https://example.com/api/health/ready",
        "http://127.0.0.1/private",
        "http://user:secret@localhost/api/health/ready",
        "http://localhost/api/health/ready?token=secret",
    ],
)
def test_health_url_cannot_target_private_or_remote_routes(url: str) -> None:
    path = Path(__file__).resolve().parents[1] / "scripts" / "vps-images.py"
    spec = importlib.util.spec_from_file_location("vps_health", path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    with pytest.raises(RuntimeError, match="loopback"):
        module.readiness(url, "v0.14.5")


def test_private_checkpoint_rejects_symlink(tool: ModuleType, tmp_path: Path) -> None:
    link = tmp_path / "state"
    try:
        link.symlink_to(tmp_path, target_is_directory=True)
    except OSError:
        pytest.skip("Symlink creation not available on this Windows host")
    with pytest.raises(RuntimeError, match="symlink"):
        tool.save_json(link / "rollback.json", {})


def test_inventory_requests_identity_fields_not_environment(
    tool: ModuleType, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls = []

    def command(*args: str) -> str:
        calls.append(args)
        if args[:3] == ("docker", "image", "ls"):
            return json.dumps({"Repository": "careertwin-app", "Tag": "v0.14.5"})
        if args[:3] == ("docker", "image", "inspect"):
            return json.dumps("sha256:app")
        if args[:2] == ("docker", "ps"):
            return "container"
        return json.dumps(
            {
                "name": "/careertwin-app-1",
                "id": "container",
                "image": "sha256:app",
                "ref": "careertwin-app:v0.14.5",
                "running": True,
            }
        )

    monkeypatch.setattr(tool, "command", command)
    result = tool.inventory()
    assert result["containers"][0]["name"] == "careertwin-app-1"
    assert result["images"] == {"careertwin-app:v0.14.5": "sha256:app"}
    inspections = [args for args in calls if "inspect" in args]
    assert all("--format" in args for args in inspections)
    assert all(".Env" not in " ".join(args) for args in inspections)


def test_disk_percent_excludes_reserved_root_blocks(
    tool: ModuleType, monkeypatch: pytest.MonkeyPatch
) -> None:
    from types import SimpleNamespace

    monkeypatch.setattr(
        tool.shutil, "disk_usage", lambda _repo: SimpleNamespace(total=100, used=70, free=25)
    )
    # Restore the real function, because the general fixture stubs filesystem reads.
    path = Path(__file__).resolve().parents[1] / "scripts" / "vps-images.py"
    spec = importlib.util.spec_from_file_location("disk_report", path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    assert module.disk(Path("."))["used_percent"] == 73.68
