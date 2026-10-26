"""PostgreSQL E2E coverage for the personal user profile contract."""

from __future__ import annotations

import os
from uuid import uuid4

import pytest
from app.core.database import SessionLocal, create_tables
from app.main import app
from app.users.models import Role, User
from app.users.schemas import UserCreate, UserUpdate
from app.users.services import create_user, update_user
from fastapi.testclient import TestClient
from sqlalchemy import select

pytestmark = [
    pytest.mark.postgres_e2e,
    pytest.mark.skipif(
        os.getenv("RUN_POSTGRES_E2E") != "1",
        reason="Set RUN_POSTGRES_E2E=1 to run against the configured PostgreSQL database",
    ),
]


def test_user_profile_persists_and_is_exposed_by_auth_me() -> None:
    """Create, read and update personal data through the real PostgreSQL app."""
    create_tables()
    suffix = uuid4().hex[:12]
    email = f"e2e-profile-{suffix}@example.com"
    identification = f"E2E-{suffix}"
    user_id: int | None = None
    with SessionLocal() as db:
        role = db.scalar(select(Role).where(Role.name == "student"))
        if role is None:
            role = Role(name="student", description="E2E student")
            db.add(role)
            db.commit()
        user = create_user(
            db,
            UserCreate(
                email=email,
                full_name="E2E Student",
                password="E2E-password-123",
                roles=["student"],
                first_name="E2E",
                last_name="Student",
                identification_number=identification,
                birth_date="2000-01-15",
                phone="+573001112233",
            ),
        )
        user_id = user.id
        update_user(
            db,
            user.id,
            UserUpdate(phone="+573009998877", last_name="Updated"),
        )

    try:
        with TestClient(app, base_url="http://localhost") as client:
            login = client.post(
                "/api/v1/auth/login",
                json={"email": email, "password": "E2E-password-123"},
            )
            assert login.status_code == 200, login.text
            profile = client.get("/api/v1/auth/me")
            assert profile.status_code == 200, profile.text
            payload = profile.json()
            assert payload["first_name"] == "E2E"
            assert payload["last_name"] == "Updated"
            assert payload["identification_number"] == identification
            assert payload["phone"] == "+573009998877"
    finally:
        with SessionLocal() as db:
            user = db.get(User, user_id)
            if user is not None:
                db.delete(user)
                db.commit()
