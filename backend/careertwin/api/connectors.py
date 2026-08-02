"""Explicit, bounded external connector endpoints."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from careertwin.api.dependencies import CsrfUser, Db
from careertwin.models import EvidenceClaim, Source, SourceStatus
from careertwin.schemas import GithubSnapshot, GithubSnapshotRequest
from careertwin.services.audit import record_audit
from careertwin.services.github_connector import GithubConnectorError, snapshot_github

router = APIRouter(prefix="/api/connectors", tags=["connectors"])


@router.post("/github/snapshot", response_model=GithubSnapshot)
def github_snapshot(payload: GithubSnapshotRequest, user: CsrfUser, db: Db) -> GithubSnapshot:
    """Use a read-only PAT for one request, persist only the bounded public portfolio snapshot."""
    try:
        result = snapshot_github(payload.token, payload.repositories)
    except GithubConnectorError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    source_ids: dict[str, str] = {}
    for repository in result["repositories"]:
        full_name = str(repository["full_name"])
        source = Source(
            workspace_id=user.workspace.id,
            kind="github",
            label=full_name,
            status=SourceStatus.READY,
            source_url=str(repository.get("html_url") or ""),
            source_metadata=repository,
        )
        db.add(source)
        db.flush()
        source_ids[full_name] = source.id
    for proposal in result["proposed_claims"]:
        repository = str(proposal.get("normalized_value", {}).get("repository", ""))
        db.add(
            EvidenceClaim(
                workspace_id=user.workspace.id,
                source_id=source_ids.get(repository),
                **proposal,
            )
        )
    record_audit(
        db,
        user,
        "connector.github_snapshot",
        "workspace",
        user.workspace.id,
        {"repositories": len(result["repositories"]), "proposals": len(result["proposed_claims"])},
    )
    return GithubSnapshot.model_validate(result)
