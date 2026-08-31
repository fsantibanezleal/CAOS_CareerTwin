"""Invite-only browser authentication endpoints."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, Response, status
from sqlalchemy import select

from careertwin.api.dependencies import Config, CsrfUser, CurrentSession, CurrentUser, Db
from careertwin.models import AuthSession, utcnow
from careertwin.schemas import (
    AccountPreferences,
    LoginRequest,
    PasswordChange,
    SessionRead,
    UserRead,
)
from careertwin.services.audit import record_audit
from careertwin.services.security import authenticate, hash_password, issue_session, verify_password

router = APIRouter(prefix="/api/auth", tags=["authentication"])


@router.post("/login", response_model=SessionRead)
def login(
    payload: LoginRequest, request: Request, response: Response, db: Db, settings: Config
) -> SessionRead:
    """Authenticate an invited account and issue secure opaque browser cookies."""
    user = authenticate(db, str(payload.email), payload.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    issued = issue_session(db, user, settings, request.headers.get("user-agent"))
    response.set_cookie(
        "ct_session",
        issued.token,
        httponly=True,
        secure=settings.secure_cookies,
        samesite="lax",
        path="/",
        max_age=settings.session_hours * 3600,
    )
    response.set_cookie(
        "ct_csrf",
        issued.csrf_token,
        httponly=False,
        secure=settings.secure_cookies,
        samesite="lax",
        path="/",
        max_age=settings.session_hours * 3600,
    )
    record_audit(db, user, "auth.login", "session", issued.record.id)
    return SessionRead(
        user=UserRead.model_validate(user),
        csrf_token=issued.csrf_token,
        expires_at=issued.record.expires_at,
    )


@router.get("/me", response_model=UserRead)
def me(user: CurrentUser) -> UserRead:
    """Return only the current account, never other seeker content."""
    return UserRead.model_validate(user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    response: Response, record: CurrentSession, user: CsrfUser, db: Db, settings: Config
) -> Response:
    """Revoke the current server-side session and clear both browser cookies."""
    record.revoked_at = utcnow()
    record_audit(db, user, "auth.logout", "session", record.id)
    response.delete_cookie("ct_session", path="/", secure=settings.secure_cookies, samesite="lax")
    response.delete_cookie("ct_csrf", path="/", secure=settings.secure_cookies, samesite="lax")
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(payload: PasswordChange, user: CsrfUser, db: Db) -> Response:
    """Replace a password, clear bootstrap status and revoke all other active sessions."""
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if payload.current_password == payload.new_password:
        raise HTTPException(status_code=400, detail="New password must be different")
    user.password_hash = hash_password(payload.new_password)
    user.must_change_password = False
    sessions = db.scalars(
        select(AuthSession).where(AuthSession.user_id == user.id, AuthSession.revoked_at.is_(None))
    ).all()
    for session in sessions:
        session.revoked_at = utcnow()
    record_audit(db, user, "auth.password_changed", "user", user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch("/preferences", response_model=UserRead)
def update_preferences(payload: AccountPreferences, user: CsrfUser, db: Db) -> UserRead:
    """Persist the current seeker's display preferences on their own account."""
    user.locale = payload.locale
    user.theme = payload.theme
    record_audit(db, user, "auth.preferences_updated", "user", user.id)
    db.flush()
    return UserRead.model_validate(user)
