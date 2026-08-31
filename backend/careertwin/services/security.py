"""Password, session, CSRF and account lifecycle primitives."""

from __future__ import annotations

import hashlib
import hmac
import secrets
from dataclasses import dataclass
from datetime import UTC, timedelta

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError
from sqlalchemy import select
from sqlalchemy.orm import Session

from careertwin.config import Settings, get_settings
from careertwin.models import AuthSession, ProfessionalProfile, User, Workspace, utcnow

_runtime = get_settings()
password_hasher = (
    PasswordHasher(time_cost=1, memory_cost=8_192, parallelism=1)
    if _runtime.app_env == "test"
    else PasswordHasher(time_cost=3, memory_cost=65_536, parallelism=4)
)


@dataclass(frozen=True)
class IssuedSession:
    """Raw tokens returned exactly once to the browser plus their persistent session row."""

    token: str
    csrf_token: str
    record: AuthSession


def hash_password(password: str) -> str:
    """Hash a password using Argon2id with an application-wide cost policy."""
    return password_hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    """Verify a password without exposing parser or mismatch details."""
    try:
        return password_hasher.verify(password_hash, password)
    except (VerifyMismatchError, InvalidHashError):
        return False


def _keyed_hash(value: str, secret: str) -> str:
    return hmac.new(secret.encode(), value.encode(), hashlib.sha256).hexdigest()


def create_user(
    db: Session,
    *,
    email: str,
    display_name: str,
    password: str,
    is_superuser: bool = False,
    locale: str = "en",
    must_change_password: bool = True,
) -> User:
    """Create an invite-only account and its one-person workspace atomically."""
    canonical_email = email.casefold().strip()
    if db.scalar(select(User).where(User.email == canonical_email)):
        raise ValueError("An account with this email already exists")
    user = User(
        email=canonical_email,
        display_name=display_name.strip(),
        password_hash=hash_password(password),
        is_superuser=is_superuser,
        locale=locale,
        must_change_password=must_change_password,
    )
    user.workspace = Workspace(name=f"{display_name.strip()}'s career workspace")
    user.workspace.profile = ProfessionalProfile()
    db.add(user)
    db.flush()
    return user


def authenticate(db: Session, email: str, password: str) -> User | None:
    """Return an active user only when the password verifies."""
    user = db.scalar(select(User).where(User.email == email.casefold().strip()))
    if user is None or not user.is_active or not verify_password(password, user.password_hash):
        return None
    if password_hasher.check_needs_rehash(user.password_hash):
        user.password_hash = hash_password(password)
    user.last_login_at = utcnow()
    return user


def issue_session(
    db: Session, user: User, settings: Settings, user_agent: str | None = None
) -> IssuedSession:
    """Create a revocable opaque session and independent double-submit CSRF token."""
    token, csrf = secrets.token_urlsafe(48), secrets.token_urlsafe(32)
    secret, csrf_secret = (
        settings.app_secret_key.get_secret_value(),
        settings.app_csrf_secret.get_secret_value(),
    )
    record = AuthSession(
        user_id=user.id,
        token_hash=_keyed_hash(token, secret),
        csrf_hash=_keyed_hash(csrf, csrf_secret),
        expires_at=utcnow() + timedelta(hours=settings.session_hours),
        user_agent_hash=(hashlib.sha256(user_agent.encode()).hexdigest() if user_agent else None),
    )
    db.add(record)
    db.flush()
    return IssuedSession(token=token, csrf_token=csrf, record=record)


def resolve_session(db: Session, token: str, settings: Settings) -> AuthSession | None:
    """Resolve a raw session token through a keyed hash and enforce revocation and expiry."""
    token_hash = _keyed_hash(token, settings.app_secret_key.get_secret_value())
    record = db.scalar(select(AuthSession).where(AuthSession.token_hash == token_hash))
    if record is None or record.revoked_at is not None:
        return None
    expires_at = record.expires_at
    if expires_at.tzinfo is None:  # SQLite drops timezone information; PostgreSQL does not.
        expires_at = expires_at.replace(tzinfo=UTC)
    if expires_at <= utcnow():
        return None
    if not record.user.is_active:
        return None
    return record


def validate_csrf(record: AuthSession, token: str, settings: Settings) -> bool:
    """Compare the request CSRF token to its separately keyed session value."""
    supplied = _keyed_hash(token, settings.app_csrf_secret.get_secret_value())
    return hmac.compare_digest(record.csrf_hash, supplied)


def revoke_all_sessions(db: Session, user_id: str) -> int:
    """Revoke every active session for an account and return the number changed."""
    sessions = db.scalars(
        select(AuthSession).where(AuthSession.user_id == user_id, AuthSession.revoked_at.is_(None))
    ).all()
    now = utcnow()
    for record in sessions:
        record.revoked_at = now
    return len(sessions)
