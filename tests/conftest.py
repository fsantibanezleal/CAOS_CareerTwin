"""Isolated API fixtures containing synthetic data only."""

from __future__ import annotations

import os
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient

os.environ["APP_ENV"] = "test"
os.environ["DATABASE_URL"] = "sqlite:///./data/private/test.sqlite3"
os.environ["APP_SECRET_KEY"] = "test-secret-that-is-long-and-never-production"
os.environ["APP_CSRF_SECRET"] = "test-csrf-secret-that-is-long-and-never-production"
os.environ["LLM_DEFAULT_PROVIDER"] = "mock"

from careertwin.database import Base, SessionLocal, engine
from careertwin.main import app
from careertwin.services.security import create_user

SYNTHETIC_TEST_PASSWORD = "-".join(("Correct", "Horse", "Battery", "42"))
ROTATED_TEST_PASSWORD = "-".join(("New", "Correct", "Horse", "Battery", "43"))
INVITE_TEST_PASSWORD = "-".join(("Temporary", "Invite", "Credential", "1234"))


@pytest.fixture(autouse=True)
def clean_database() -> Generator[None, None, None]:
    """Recreate the schema around each test so no account can leak across cases."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    """Provide an in-process browser client with cookie persistence."""
    with TestClient(app) as test_client:
        yield test_client


def create_account(
    email: str,
    password: str = SYNTHETIC_TEST_PASSWORD,
    *,
    superuser: bool = False,
) -> str:
    """Create a synthetic invited account directly through the bootstrap service."""
    with SessionLocal.begin() as db:
        user = create_user(
            db,
            email=email,
            display_name=email.split("@")[0].title(),
            password=password,
            is_superuser=superuser,
            must_change_password=False,
        )
        return user.id


def login(client: TestClient, email: str, password: str = SYNTHETIC_TEST_PASSWORD) -> str:
    """Authenticate and return the CSRF token needed for state-changing calls."""
    response = client.post("/api/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return str(response.json()["csrf_token"])


def csrf(token: str) -> dict[str, str]:
    """Build the explicit anti-CSRF header."""
    return {"X-CSRF-Token": token}
