#!/usr/bin/env python3
"""Exercise representative public-alpha volumes against an isolated local database."""

from __future__ import annotations

import argparse
import json
import math
import os
import statistics
import tempfile
import time
from pathlib import Path
from typing import Any


def _arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--p95-ms", type=float, default=2500, help="Maximum accepted API p95")
    return parser.parse_args()


def main() -> int:
    """Build the fixed 10x100x50x50 fixture and time representative read paths."""
    args = _arguments()
    with tempfile.TemporaryDirectory(prefix="careertwin-load-") as directory:
        database_path = Path(directory) / "representative.sqlite3"
        os.environ.update(
            {
                "APP_ENV": "test",
                "DATABASE_URL": f"sqlite:///{database_path.as_posix()}",
                "APP_SECRET_KEY": "representative-load-secret-not-for-production",
                "APP_CSRF_SECRET": "representative-load-csrf-not-for-production",
                "LLM_DEFAULT_PROVIDER": "mock",
            }
        )

        from fastapi.testclient import TestClient
        from sqlalchemy import func, select

        from careertwin.database import Base, SessionLocal, engine
        from careertwin.main import app
        from careertwin.models import Opportunity, Requirement, Source, SourceStatus, User
        from careertwin.services.security import create_user

        users = 10
        opportunities_per_user = 100
        documents_per_user = 50
        repositories_per_user = 50
        password = "-".join(("Representative", "Load", "Password", "42"))
        Base.metadata.create_all(bind=engine)
        setup_started = time.perf_counter()
        emails: list[str] = []
        with SessionLocal.begin() as db:
            for user_index in range(users):
                email = f"load-{user_index}@example.com"
                emails.append(email)
                user = create_user(
                    db,
                    email=email,
                    display_name=f"Load Seeker {user_index}",
                    password=password,
                    must_change_password=False,
                )
                workspace_id = user.workspace.id
                for opportunity_index in range(opportunities_per_user):
                    db.add(
                        Opportunity(
                            workspace_id=workspace_id,
                            title=f"Synthetic role {opportunity_index}",
                            employer=f"Employer {opportunity_index % 20}",
                            description="Representative bounded posting text.",
                            source_kind="manual",
                            industry=f"Industry {opportunity_index % 8}",
                            area="Engineering",
                            seniority=["junior", "mid", "senior", "lead"][opportunity_index % 4],
                            location="Remote",
                            remote_mode="remote",
                            status="active",
                            requirements=[
                                Requirement(
                                    workspace_id=workspace_id,
                                    category="skill",
                                    label=f"Skill {opportunity_index % 25}",
                                    normalized_name=f"skill {opportunity_index % 25}",
                                    importance="required",
                                    weight=1,
                                    minimum_level=0.5,
                                    source_locator={"fixture": opportunity_index},
                                )
                            ],
                        )
                    )
                for source_index in range(documents_per_user):
                    db.add(
                        Source(
                            workspace_id=workspace_id,
                            kind="document",
                            label=f"Document {source_index}",
                            status=SourceStatus.READY,
                            media_type="text/plain",
                            sha256=f"{user_index:02x}{source_index:02x}".ljust(64, "0"),
                            source_metadata={"fixture": True},
                        )
                    )
                for source_index in range(repositories_per_user):
                    db.add(
                        Source(
                            workspace_id=workspace_id,
                            kind="github_repository",
                            label=f"example/repository-{source_index}",
                            status=SourceStatus.READY,
                            source_url=f"https://github.com/example/repository-{source_index}",
                            source_metadata={"language": "Python", "fixture": True},
                        )
                    )
        setup_seconds = time.perf_counter() - setup_started

        timings: list[dict[str, Any]] = []
        endpoints = (
            "/api/workspace/today",
            "/api/opportunities",
            "/api/opportunities/visualization/landscape",
            "/api/profile/graph",
            "/api/matches/portfolio/alignment",
        )
        with TestClient(app) as client:
            for email in emails:
                response = client.post("/api/auth/login", json={"email": email, "password": password})
                if response.status_code != 200:
                    raise RuntimeError(f"Login failed for synthetic account: {response.status_code}")
                for endpoint in endpoints:
                    started = time.perf_counter()
                    response = client.get(endpoint)
                    duration_ms = (time.perf_counter() - started) * 1000
                    if response.status_code != 200:
                        raise RuntimeError(f"{endpoint} failed: {response.status_code}")
                    timings.append({"endpoint": endpoint, "duration_ms": round(duration_ms, 3)})

        durations = sorted(float(item["duration_ms"]) for item in timings)
        p95_index = max(0, math.ceil(len(durations) * 0.95) - 1)
        counts: dict[str, int] = {}
        with SessionLocal() as db:
            counts = {
                "users": int(db.scalar(select(func.count()).select_from(User)) or 0),
                "opportunities": int(db.scalar(select(func.count()).select_from(Opportunity)) or 0),
                "requirements": int(db.scalar(select(func.count()).select_from(Requirement)) or 0),
                "sources": int(db.scalar(select(func.count()).select_from(Source)) or 0),
            }
        expected = {
            "users": users,
            "opportunities": users * opportunities_per_user,
            "requirements": users * opportunities_per_user,
            "sources": users * (documents_per_user + repositories_per_user),
        }
        if counts != expected:
            raise RuntimeError(f"Representative fixture mismatch: {counts} != {expected}")
        report = {
            "contract": {
                "users": users,
                "opportunities_per_user": opportunities_per_user,
                "documents_per_user": documents_per_user,
                "repositories_per_user": repositories_per_user,
            },
            "counts": counts,
            "setup_seconds": round(setup_seconds, 3),
            "requests": len(timings),
            "latency_ms": {
                "mean": round(statistics.fmean(durations), 3),
                "p95": durations[p95_index],
                "max": durations[-1],
                "threshold_p95": args.p95_ms,
            },
        }
        print(json.dumps(report, indent=2, sort_keys=True))
        threshold_failed = durations[p95_index] > args.p95_ms
        engine.dispose()
        if threshold_failed:
            raise RuntimeError(f"Representative p95 exceeded {args.p95_ms} ms")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
