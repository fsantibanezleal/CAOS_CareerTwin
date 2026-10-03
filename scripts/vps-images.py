#!/usr/bin/env python3
"""Fail-closed, POSIX VPS image retention; never delete volumes or personal files.

All commands are argument lists, not shells. Planning is read-only. Cleanup requires
an explicit apply flag and an owner-only checkpoint containing two reviewed rollback
pairs. Deployment and cleanup must share the advisory lock in the state directory.
"""

from __future__ import annotations

import argparse
import contextlib
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.request
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import urlsplit

RELEASE = re.compile(r"v\d+\.\d+\.\d+\Z")
REPOSITORIES = ("careertwin-app", "careertwin-db")
SERVICES = ("careertwin-app-1", "careertwin-worker-1", "careertwin-db-1")


def command(*args: str) -> str:
    """Run one bounded command; do not expose arbitrary stderr/configuration."""
    result = subprocess.run(args, capture_output=True, text=True, timeout=600, check=False)  # noqa: S603
    if result.returncode:
        raise RuntimeError(f"{args[0]} {args[1]} failed (exit {result.returncode})")
    return result.stdout


def inventory() -> dict:
    """Read only identity fields, never container environment or user data."""
    tags = sorted(
        {
            row["Repository"] + ":" + row["Tag"]
            for line in command("docker", "image", "ls", "--format", "{{json .}}").splitlines()
            if (row := json.loads(line))["Repository"] in REPOSITORIES and row["Tag"] != "<none>"
        }
    )
    images = {}
    if tags:
        for ref, item in zip(
            tags, json.loads(command("docker", "image", "inspect", *tags)), strict=True
        ):
            images[ref] = item["Id"]
    ids = command("docker", "ps", "-aq", "--no-trunc").split()
    containers = []
    if ids:
        for item in json.loads(command("docker", "container", "inspect", *ids)):
            containers.append(
                {
                    "name": item["Name"].lstrip("/"),
                    "id": item["Id"],
                    "image": item["Image"],
                    "ref": item["Config"]["Image"],
                    "running": item["State"]["Running"],
                }
            )
    return {"images": images, "containers": sorted(containers, key=lambda c: c["name"])}


def current_release(snapshot: dict) -> str:
    """Require a consistent running app/worker/database release, not a candidate."""
    services = {c["name"]: c for c in snapshot["containers"]}
    refs = []
    for name in SERVICES:
        service = services.get(name)
        if not service or not service["running"]:
            raise RuntimeError(f"Required service is not running: {name}")
        repository = "careertwin-db" if name.endswith("db-1") else "careertwin-app"
        ref = service["ref"]
        if not ref.startswith(repository + ":") or ref not in snapshot["images"]:
            raise RuntimeError("Running image must have a local CareerTwin release tag")
        if service["image"] != snapshot["images"][ref]:
            raise RuntimeError("Running image identity differs from its local tag")
        refs.append(ref.split(":", 1)[1])
    if len(set(refs)) != 1 or not RELEASE.fullmatch(refs[0]):
        raise RuntimeError("App, worker and database must share one immutable release tag")
    return refs[0]


def version(tag: str) -> tuple[int, ...]:
    """Compare release numbers numerically, including padded display tags."""
    if not RELEASE.fullmatch(tag):
        raise RuntimeError("Invalid release tag")
    return tuple(int(part) for part in tag[1:].split("."))


def release_record(repo: Path, tag: str, snapshot: dict) -> dict:
    """Resolve an actual Git tag and fingerprint its migration source tree."""
    if not RELEASE.fullmatch(tag):
        raise RuntimeError("Only numeric vMAJOR.MINOR.PATCH release tags can be pinned")
    commit = command(
        "git", "-C", str(repo), "rev-parse", "--verify", f"refs/tags/{tag}^{{commit}}"
    ).strip()
    tree = command("git", "-C", str(repo), "ls-tree", "-r", commit, "alembic/versions")
    if not tree.strip():
        raise RuntimeError("Release has no migration tree")
    images = {name: snapshot["images"].get(f"{name}:{tag}") for name in REPOSITORIES}
    if not all(images.values()):
        raise RuntimeError(f"Rollback pair is incomplete: {tag}")
    return {
        "tag": tag,
        "commit": commit,
        "migration_tree": hashlib.sha256(tree.encode()).hexdigest(),
        "images": images,
    }


def readiness(url: str, tag: str) -> dict:
    """Permit only unauthenticated loopback health checks, never arbitrary URLs."""
    parsed = urlsplit(url)
    if (
        parsed.scheme != "http"
        or parsed.hostname not in ("127.0.0.1", "localhost", "::1")
        or parsed.username
        or parsed.password
        or parsed.query
        or parsed.fragment
        or parsed.path != "/api/health/ready"
    ):
        raise RuntimeError("Health URL must be an HTTP loopback /api/health/ready endpoint")
    with urllib.request.urlopen(url, timeout=10) as response:  # noqa: S310
        payload = json.load(response)
    if payload.get("status") != "ok" or payload.get("version") != tag[1:]:
        raise RuntimeError("Running release readiness/version mismatch")
    return payload


def disk(repo: Path) -> dict:
    """Report physical filesystem space, not the sum of shared image sizes."""
    space = shutil.disk_usage(repo)
    return {
        "total_bytes": space.total,
        "used_bytes": space.used,
        "free_bytes": space.free,
        "used_percent": round(space.used / space.total * 100, 2),
    }


def private_directory(path: Path) -> None:
    """Refuse symlink traversal and establish owner-only operational records."""
    if not path.is_absolute() or any(p.is_symlink() for p in (path, *path.parents)):
        raise RuntimeError("State directory must be absolute with no symlink ancestors")
    path.mkdir(mode=0o700, parents=True, exist_ok=True)
    if path.stat().st_uid != os.getuid():
        raise RuntimeError("State directory is not owned by the operator")
    os.chmod(path, 0o700)


def save_json(path: Path, value: dict) -> None:
    """Atomically persist mode-0600 journal data without credentials or identities."""
    private_directory(path.parent)
    if path.is_symlink():
        raise RuntimeError("Refusing a symlink journal")
    descriptor, temporary = tempfile.mkstemp(prefix=".journal-", dir=path.parent)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as stream:
            json.dump(value, stream, indent=2)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


@contextlib.contextmanager
def maintenance_lock(state: Path):
    """Serialize operators with a nonblocking POSIX lock; never register automation."""
    import fcntl

    private_directory(state)
    target = state / "maintenance.lock"
    descriptor = os.open(target, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    with os.fdopen(descriptor, "w") as stream:
        fcntl.flock(stream, fcntl.LOCK_EX | fcntl.LOCK_NB)
        yield


def checkpoint(repo: Path, snapshot: dict, rollbacks: list[str], health_url: str) -> dict:
    """Pin current plus exactly two explicit older schema-identical release pairs.

    A matching migration tree is a conservative eligibility check, not proof that
    an old application can operate current data. Rehearse it in isolation first.
    """
    current = current_release(snapshot)
    if len(rollbacks) != 2 or len(set(rollbacks)) != 2:
        raise RuntimeError("Exactly two distinct rollback releases must be selected")
    active = release_record(repo, current, snapshot)
    records = [release_record(repo, tag, snapshot) for tag in rollbacks]
    if any(version(item["tag"]) >= version(current) for item in records):
        raise RuntimeError("Rollback releases must precede the current release")
    if any(item["migration_tree"] != active["migration_tree"] for item in records):
        raise RuntimeError("Changed migration tree: retain manually and rehearse compatibility")
    readiness(health_url, current)
    return {
        "format": 1,
        "recorded_at": datetime.now(UTC).isoformat(),
        "current": active,
        "rollbacks": records,
        "rollback_runtime_verified": False,
    }


def load_manifest(state: Path) -> dict:
    """Require an owner-only regular checkpoint before planning or rotating it."""
    target = state / "rollback.json"
    if any(p.is_symlink() for p in (target, *target.parents)):
        raise RuntimeError("Refusing a symlink checkpoint path")
    info = target.stat()
    if info.st_uid != os.getuid() or info.st_mode & 0o077:
        raise RuntimeError("Checkpoint must be operator-owned and mode 0600")
    return json.loads(target.read_text(encoding="utf-8"))


def rotate_pins(snapshot: dict, previous: dict) -> list[str]:
    """Carry forward the previous healthy release and its newest rollback pin."""
    active = current_release(snapshot)
    if previous.get("format") != 1 or version(active) < version(previous["current"]["tag"]):
        raise RuntimeError("Checkpoint cannot rotate backward or use an unknown format")
    candidates = [previous["current"], *previous["rollbacks"]]
    tags = [item["tag"] for item in candidates if item["tag"] != active]
    return list(dict.fromkeys(tags))[:2]


def plan(repo: Path, snapshot: dict, manifest: dict) -> dict:
    """Fail closed on stale/modified pins, preserve all container references/aliases."""
    active = current_release(snapshot)
    if manifest.get("format") != 1 or manifest["current"]["tag"] != active:
        raise RuntimeError("Checkpoint is stale; record the healthy current release first")
    records = [manifest["current"], *manifest["rollbacks"]]
    if len(records) != 3 or len({item["tag"] for item in records}) != 3:
        raise RuntimeError("A current release and two distinct rollback pins are required")
    for item in records:
        if release_record(repo, item["tag"], snapshot) != item:
            raise RuntimeError("Pinned image/Git identity changed; cleanup refused")
        if item["migration_tree"] != records[0]["migration_tree"]:
            raise RuntimeError("Pinned migration compatibility changed")
    protected_ids = {c["image"] for c in snapshot["containers"]}
    protected_refs = {c["ref"] for c in snapshot["containers"]}
    protected_refs.update(f"{name}:{item['tag']}" for item in records for name in REPOSITORIES)
    protected_ids.update(
        snapshot["images"][ref] for ref in protected_refs if ref in snapshot["images"]
    )
    remove = {
        ref: image
        for ref, image in snapshot["images"].items()
        if ref.split(":", 1)[0] in REPOSITORIES
        and ref not in protected_refs
        and image not in protected_ids
    }
    return {
        "retained_releases": [item["tag"] for item in records],
        "remove_tags": remove,
        "protected_image_ids": sorted(protected_ids),
        "disk_before": disk(repo),
        "cache_policy": "default builder unused cache, max 2GB, no volumes or global image prune",
    }


def apply_cleanup(
    repo: Path, state: Path, snapshot: dict, manifest: dict, health_url: str, prune_cache: bool
) -> dict:
    """Recheck inventory/health before mutation; remove exact tags without force.

    Persistent volumes, stopped containers, backups and host files are never deletion
    targets. Docker also refuses removing a container-dependent image without force.
    """
    proposal = plan(repo, snapshot, manifest)
    readiness(health_url, manifest["current"]["tag"])
    if inventory() != snapshot:
        raise RuntimeError("Docker inventory changed; review a fresh plan")
    report = {**proposal, "removed_tags": [], "completed": False}
    save_json(state / "last-cleanup.json", report)
    try:
        for ref, expected in proposal["remove_tags"].items():
            live = inventory()
            if live["containers"] != snapshot["containers"] or live["images"].get(ref) != expected:
                raise RuntimeError("Container/tag changed during cleanup; stopping")
            command("docker", "image", "rm", ref)
            report["removed_tags"].append(ref)
        if prune_cache:
            command(
                "docker",
                "buildx",
                "--builder",
                "default",
                "prune",
                "--force",
                "--max-used-space",
                "2GB",
            )
        after = inventory()
        if after["containers"] != snapshot["containers"]:
            raise RuntimeError("Container identities changed during cleanup")
        plan(repo, after, manifest)
        readiness(health_url, manifest["current"]["tag"])
        report["completed"] = True
        return report
    finally:
        report["disk_after"] = disk(repo)
        report["finished_at"] = datetime.now(UTC).isoformat()
        save_json(state / "last-cleanup.json", report)


def main() -> None:
    """Expose explicit checkpoint, dry-run, apply and capacity gates on the VPS."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("checkpoint", "plan", "clean", "preflight"))
    parser.add_argument("--repo", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--state-dir", type=Path)
    parser.add_argument("--health-url", default="http://127.0.0.1:8144/api/health/ready")
    parser.add_argument("--keep-release", action="append", default=[])
    parser.add_argument("--apply", action="store_true")
    parser.add_argument(
        "--prune-cache",
        action="store_true",
        help="Explicitly bound the host's shared default-builder cache to 2GB",
    )
    parser.add_argument("--min-free-gib", type=float, default=10)
    args = parser.parse_args()
    repo = args.repo.resolve(strict=True)
    state = args.state_dir or repo / ".run" / "vps-operations"
    if args.action == "preflight":
        if args.min_free_gib < 10:
            raise RuntimeError("Capacity reserve must be at least 10 GiB")
        report = disk(repo)
        print(json.dumps(report, indent=2))
        if report["free_bytes"] < args.min_free_gib * 1024**3 or report["used_percent"] >= 80:
            raise RuntimeError("Insufficient build headroom; clean before deploying")
        return
    if args.action == "checkpoint":
        with maintenance_lock(state):
            snapshot = inventory()
            pins = args.keep_release
            if not pins:
                previous = load_manifest(state)
                for item in [previous["current"], *previous["rollbacks"]]:
                    if release_record(repo, item["tag"], snapshot) != item:
                        raise RuntimeError("Previous checkpoint identity changed; rotation refused")
                pins = rotate_pins(snapshot, previous)
            report = checkpoint(repo, snapshot, pins, args.health_url)
            save_json(state / "rollback.json", report)
    else:
        manifest = load_manifest(state)
        if args.action == "clean" and args.apply:
            with maintenance_lock(state):
                manifest = load_manifest(state)
                report = apply_cleanup(
                    repo, state, inventory(), manifest, args.health_url, args.prune_cache
                )
        else:
            report = plan(repo, inventory(), manifest)
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, OSError, ValueError, KeyError, subprocess.TimeoutExpired) as error:
        print(f"Maintenance refused: {error}", file=sys.stderr)
        sys.exit(1)
