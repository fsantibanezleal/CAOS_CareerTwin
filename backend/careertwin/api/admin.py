"""Superuser account lifecycle endpoints with no cross-account career-content browser."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import select

from careertwin.api.dependencies import Config, CsrfSuperuser, Db, Superuser
from careertwin.models import User
from careertwin.schemas import AdminUserCreate, UserRead
from careertwin.services.audit import record_audit
from careertwin.services.blob import configured_blob_store
from careertwin.services.security import create_user, revoke_all_sessions

router = APIRouter(prefix="/api/admin", tags=["administration"])


@router.get("/users", response_model=list[UserRead])
def list_users(_: Superuser, db: Db) -> list[UserRead]:
    """List account metadata only, never profiles, sources, jobs, matches or conversations."""
    users = db.scalars(select(User).order_by(User.created_at.desc())).all()
    return [UserRead.model_validate(user) for user in users]


@router.post("/users", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def add_user(payload: AdminUserCreate, actor: CsrfSuperuser, db: Db) -> UserRead:
    """Create an invited account and independent seeker workspace."""
    try:
        user = create_user(
            db,
            email=str(payload.email),
            display_name=payload.display_name,
            password=payload.temporary_password,
            is_superuser=payload.is_superuser,
            locale=payload.locale,
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    record_audit(
        db, actor, "admin.user_created", "user", user.id, {"is_superuser": user.is_superuser}
    )
    return UserRead.model_validate(user)


@router.post("/users/{user_id}/disable", response_model=UserRead)
def disable_user(user_id: str, actor: CsrfSuperuser, db: Db) -> UserRead:
    """Disable an account and revoke its active sessions while retaining recoverable data."""
    target = db.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.id == actor.id:
        raise HTTPException(
            status_code=409, detail="A superuser cannot disable the current account"
        )
    target.is_active = False
    revoked = revoke_all_sessions(db, target.id)
    record_audit(db, actor, "admin.user_disabled", "user", target.id, {"sessions_revoked": revoked})
    return UserRead.model_validate(target)


@router.post("/users/{user_id}/restore", response_model=UserRead)
def restore_user(user_id: str, actor: CsrfSuperuser, db: Db) -> UserRead:
    """Restore a previously disabled account without changing its career content."""
    target = db.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    target.is_active = True
    record_audit(db, actor, "admin.user_restored", "user", target.id)
    return UserRead.model_validate(target)


@router.post("/users/{user_id}/revoke-sessions")
def revoke_user_sessions(user_id: str, actor: CsrfSuperuser, db: Db) -> dict[str, int]:
    """Revoke every session belonging to an account."""
    if not db.get(User, user_id):
        raise HTTPException(status_code=404, detail="User not found")
    count = revoke_all_sessions(db, user_id)
    record_audit(db, actor, "admin.sessions_revoked", "user", user_id, {"count": count})
    return {"revoked": count}


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def purge_user(
    user_id: str,
    confirm: str,
    actor: CsrfSuperuser,
    db: Db,
    settings: Config,
) -> Response:
    """Permanently purge an account only after an exact explicit confirmation value."""
    target = db.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.id == actor.id:
        raise HTTPException(status_code=409, detail="A superuser cannot purge the current account")
    if confirm != target.email:
        raise HTTPException(
            status_code=400, detail="Confirmation must exactly match the account email"
        )
    target_id = target.id
    workspace_id = target.workspace.id
    db.delete(target)
    record_audit(db, actor, "admin.user_purged", "user", target_id)
    # Remove private files inside the same request transaction. A filesystem failure
    # rolls the database deletion back, leaving an operator-visible account that can
    # be retried instead of silently reporting a partial purge.
    configured_blob_store(settings).delete_workspace(workspace_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
