"""Google and Microsoft delegated OAuth 2.0 with PKCE and encrypted refresh tokens."""

from __future__ import annotations

import base64
import hashlib
import secrets
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import timedelta
from urllib.parse import urlencode

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from careertwin.config import Settings
from careertwin.models import ExternalConnection, OAuthAuthorization, utcnow
from careertwin.services.connector_crypto import open_json, seal_json


@dataclass(frozen=True)
class OAuthProvider:
    name: str
    client_id: str
    client_secret: str
    authorize_url: str
    token_url: str
    identity_url: str


def _provider(settings: Settings, name: str) -> OAuthProvider:
    if name == "google":
        if not settings.google_oauth_client_id or not settings.google_oauth_client_secret:
            raise ValueError("Google OAuth is not configured")
        return OAuthProvider(
            name="google",
            client_id=settings.google_oauth_client_id,
            client_secret=settings.google_oauth_client_secret.get_secret_value(),
            authorize_url="https://accounts.google.com/o/oauth2/v2/auth",
            token_url="https://oauth2.googleapis.com/token",  # noqa: S106 - public endpoint URL
            identity_url="https://www.googleapis.com/oauth2/v2/userinfo",
        )
    if name == "microsoft":
        if not settings.microsoft_oauth_client_id or not settings.microsoft_oauth_client_secret:
            raise ValueError("Microsoft OAuth is not configured")
        tenant = settings.microsoft_oauth_tenant.strip()
        if not tenant or any(
            character not in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-."
            for character in tenant
        ):
            raise ValueError("Microsoft OAuth tenant is invalid")
        base = f"https://login.microsoftonline.com/{tenant}/oauth2/v2.0"
        return OAuthProvider(
            name="microsoft",
            client_id=settings.microsoft_oauth_client_id,
            client_secret=settings.microsoft_oauth_client_secret.get_secret_value(),
            authorize_url=f"{base}/authorize",
            token_url=f"{base}/token",
            identity_url="https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName",
        )
    raise ValueError("Unsupported OAuth provider")


def configured_oauth_providers(settings: Settings) -> dict[str, bool]:
    """Return configuration presence only; never include client values."""
    return {
        "google": bool(settings.google_oauth_client_id and settings.google_oauth_client_secret),
        "microsoft": bool(
            settings.microsoft_oauth_client_id and settings.microsoft_oauth_client_secret
        ),
    }


def _scopes(provider: str, services: Sequence[str]) -> list[str]:
    requested = set(services)
    if provider == "google":
        scopes = ["openid", "email", "profile"]
        if "calendar" in requested:
            scopes.append("https://www.googleapis.com/auth/calendar.events")
        if "email" in requested:
            scopes.append("https://www.googleapis.com/auth/gmail.readonly")
        return scopes
    scopes = ["openid", "profile", "email", "offline_access", "User.Read"]
    if "calendar" in requested:
        scopes.append("Calendars.ReadWrite")
    if "email" in requested:
        scopes.append("Mail.Read")
    return scopes


def _redirect_uri(settings: Settings, provider: str) -> str:
    return f"{settings.app_public_url.rstrip('/')}/api/connectors/oauth/{provider}/callback"


def start_authorization(
    db: Session,
    settings: Settings,
    workspace_id: str,
    provider_name: str,
    services: Sequence[str],
    redirect_after: str,
) -> str:
    """Persist one-time state/PKCE material and return the real provider consent URL."""
    provider = _provider(settings, provider_name)
    verifier = secrets.token_urlsafe(64)
    challenge = (
        base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip("=")
    )
    state = secrets.token_urlsafe(32)
    state_hash = hashlib.sha256(state.encode()).hexdigest()
    authorization = OAuthAuthorization(
        workspace_id=workspace_id,
        provider=provider.name,
        state_hash=state_hash,
        encrypted_verifier=seal_json(
            settings,
            workspace_id,
            provider.name,
            f"oauth-state:{state_hash}",
            {"verifier": verifier, "services": list(services)},
        ),
        redirect_after=redirect_after,
        expires_at=utcnow() + timedelta(minutes=10),
    )
    db.add(authorization)
    parameters = {
        "client_id": provider.client_id,
        "redirect_uri": _redirect_uri(settings, provider.name),
        "response_type": "code",
        "scope": " ".join(_scopes(provider.name, services)),
        "state": state,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
    }
    if provider.name == "google":
        parameters.update({"access_type": "offline", "prompt": "consent"})
    return f"{provider.authorize_url}?{urlencode(parameters)}"


def complete_authorization(
    db: Session,
    settings: Settings,
    workspace_id: str,
    provider_name: str,
    state: str,
    code: str,
) -> tuple[ExternalConnection, str]:
    """Consume OAuth state, exchange the code and persist encrypted delegated credentials."""
    provider = _provider(settings, provider_name)
    state_hash = hashlib.sha256(state.encode()).hexdigest()
    authorization = db.scalar(
        select(OAuthAuthorization).where(
            OAuthAuthorization.workspace_id == workspace_id,
            OAuthAuthorization.provider == provider.name,
            OAuthAuthorization.state_hash == state_hash,
            OAuthAuthorization.consumed_at.is_(None),
            OAuthAuthorization.expires_at > utcnow(),
        )
    )
    if not authorization:
        raise ValueError("OAuth state is invalid or expired")
    verifier_payload = open_json(
        settings,
        workspace_id,
        provider.name,
        f"oauth-state:{state_hash}",
        authorization.encrypted_verifier,
    )
    response = httpx.post(
        provider.token_url,
        data={
            "client_id": provider.client_id,
            "client_secret": provider.client_secret,
            "code": code,
            "code_verifier": verifier_payload["verifier"],
            "grant_type": "authorization_code",
            "redirect_uri": _redirect_uri(settings, provider.name),
        },
        timeout=20,
    )
    response.raise_for_status()
    tokens = response.json()
    access_token = str(tokens.get("access_token", ""))
    if not access_token:
        raise ValueError("OAuth provider returned no access token")
    identity_response = httpx.get(
        provider.identity_url,
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=20,
    )
    identity_response.raise_for_status()
    identity = identity_response.json()
    subject = str(identity.get("id") or identity.get("sub") or "")
    if not subject:
        raise ValueError("OAuth provider returned no account subject")
    existing = db.scalar(
        select(ExternalConnection).where(
            ExternalConnection.workspace_id == workspace_id,
            ExternalConnection.provider == provider.name,
            ExternalConnection.account_subject == subject,
        )
    )
    if existing and not tokens.get("refresh_token"):
        previous = open_json(
            settings,
            workspace_id,
            provider.name,
            "oauth-token",
            existing.encrypted_credentials,
        )
        if previous.get("refresh_token"):
            tokens["refresh_token"] = previous["refresh_token"]
    expires_in = int(tokens.get("expires_in", 3600))
    scopes = str(
        tokens.get("scope") or " ".join(_scopes(provider.name, verifier_payload["services"]))
    ).split()
    encrypted = seal_json(settings, workspace_id, provider.name, "oauth-token", dict(tokens))
    connection = existing or ExternalConnection(
        workspace_id=workspace_id,
        provider=provider.name,
        account_subject=subject,
        encrypted_credentials=encrypted,
    )
    connection.encrypted_credentials = encrypted
    connection.status = "connected"
    connection.scopes = scopes
    connection.token_expires_at = utcnow() + timedelta(seconds=max(60, expires_in))
    connection.connection_metadata = {
        **(connection.connection_metadata or {}),
        "display_name": str(identity.get("name") or identity.get("displayName") or "")[:300],
        "account_hint": str(
            identity.get("email") or identity.get("mail") or identity.get("userPrincipalName") or ""
        )[:320],
        "services": list(verifier_payload["services"]),
    }
    db.add(connection)
    authorization.consumed_at = utcnow()
    return connection, authorization.redirect_after


def access_token(db: Session, settings: Settings, connection: ExternalConnection) -> str:
    """Return a valid access token, refreshing and re-encrypting it when necessary."""
    tokens = open_json(
        settings,
        connection.workspace_id,
        connection.provider,
        "oauth-token",
        connection.encrypted_credentials,
    )
    if connection.token_expires_at and connection.token_expires_at > utcnow() + timedelta(
        minutes=2
    ):
        return str(tokens["access_token"])
    refresh_token = str(tokens.get("refresh_token", ""))
    if not refresh_token:
        connection.status = "reauthorization_required"
        raise ValueError("Connector requires authorization again")
    provider = _provider(settings, connection.provider)
    response = httpx.post(
        provider.token_url,
        data={
            "client_id": provider.client_id,
            "client_secret": provider.client_secret,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        },
        timeout=20,
    )
    response.raise_for_status()
    refreshed = response.json()
    refreshed.setdefault("refresh_token", refresh_token)
    connection.encrypted_credentials = seal_json(
        settings,
        connection.workspace_id,
        connection.provider,
        "oauth-token",
        refreshed,
    )
    connection.token_expires_at = utcnow() + timedelta(
        seconds=max(60, int(refreshed.get("expires_in", 3600)))
    )
    connection.status = "connected"
    db.flush()
    return str(refreshed["access_token"])
