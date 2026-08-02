"""Authentication, authorization, CSRF and tenant boundary dependencies."""

from __future__ import annotations

from typing import Annotated

from fastapi import Cookie, Depends, Header, HTTPException, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from careertwin.config import Settings, get_settings
from careertwin.database import get_db
from careertwin.models import AuthSession, User
from careertwin.services.security import resolve_session, validate_csrf

Db = Annotated[Session, Depends(get_db)]
Config = Annotated[Settings, Depends(get_settings)]


def current_auth_session(
    db: Db,
    settings: Config,
    session_token: Annotated[str | None, Cookie(alias="ct_session")] = None,
) -> AuthSession:
    """Resolve the opaque session cookie without accepting bearer or query-string alternatives."""
    if not session_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required"
        )
    record = resolve_session(db, session_token, settings)
    if not record:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Session is invalid or expired"
        )
    if db.bind is not None and db.bind.dialect.name == "postgresql":
        db.execute(
            text("SELECT set_config('app.workspace_id', :workspace_id, true)"),
            {"workspace_id": record.user.workspace.id},
        )
        db.execute(
            text("SELECT set_config('app.is_admin', :is_admin, true)"),
            {"is_admin": "true" if record.user.is_superuser else "false"},
        )
    return record


CurrentSession = Annotated[AuthSession, Depends(current_auth_session)]


def current_user(record: CurrentSession) -> User:
    """Return the authenticated active account."""
    return record.user


CurrentUser = Annotated[User, Depends(current_user)]


def csrf_user(
    record: CurrentSession,
    settings: Config,
    csrf_header: Annotated[str | None, Header(alias="X-CSRF-Token")] = None,
    csrf_cookie: Annotated[str | None, Cookie(alias="ct_csrf")] = None,
) -> User:
    """Enforce matching header/cookie tokens and the independent persisted CSRF hash."""
    if not csrf_header or not csrf_cookie or csrf_header != csrf_cookie:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="CSRF validation failed")
    if not validate_csrf(record, csrf_header, settings):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="CSRF validation failed")
    return record.user


CsrfUser = Annotated[User, Depends(csrf_user)]


def superuser(user: CurrentUser) -> User:
    """Authorize account administration without granting career-content browsing."""
    if not user.is_superuser:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Superuser required")
    return user


Superuser = Annotated[User, Depends(superuser)]


def csrf_superuser(user: CsrfUser) -> User:
    """Require both superuser role and CSRF proof for administrative mutations."""
    if not user.is_superuser:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Superuser required")
    return user


CsrfSuperuser = Annotated[User, Depends(csrf_superuser)]
