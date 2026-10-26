"""PostgreSQL E2E coverage for the personal user profile contract."""

from __future__ import annotations

import os
from uuid import uuid4

import pytest

pytestmark = [
    pytest.mark.postgres_e2e,
    pytest.mark.skipif(
        os.getenv("RUN_POSTGRES_E2E") != "1",
        reason="Set RUN_POSTGRES_E2E=1 to run against the configured PostgreSQL database",
    ),
]


def test_user_profile_persists_and_is_exposed_by_auth_me() -> None:
    """Create, read and update personal data through the real PostgreSQL app."""
    from app.core.database import SessionLocal, create_tables
    from app.main import app
    from app.users.models import Role, User
    from app.users.schemas import UserCreate, UserUpdate
    from app.users.services import create_user, update_user
    from fastapi.testclient import TestClient
    from sqlalchemy import select

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


def test_user_lookup_requires_academic_permission() -> None:
    """Lookup returns minimal data only to an authorized academic caller."""
    from app.core.database import SessionLocal, create_tables
    from app.main import app
    from app.users.models import Permission, Role, RolePermission, User
    from app.users.schemas import UserCreate
    from app.users.services import create_user
    from fastapi.testclient import TestClient
    from sqlalchemy import select

    create_tables()
    suffix = uuid4().hex[:12]
    role_name = f"e2e.lookup.{suffix}"
    permission_name = "subjects.manage"
    actor_email = f"e2e-lookup-actor-{suffix}@example.com"
    target_email = f"e2e-lookup-target-{suffix}@example.com"
    student_email = f"e2e-lookup-student-{suffix}@example.com"
    user_ids: list[int] = []
    role_id: int | None = None
    permission_id: int | None = None
    permission_created = False
    with SessionLocal() as db:
        role = Role(name=role_name, description="E2E lookup role")
        permission = db.scalar(
            select(Permission).where(Permission.name == permission_name)
        )
        if permission is None:
            permission = Permission(name=permission_name, description="Manage subjects")
            permission_created = True
        db.add(role)
        db.add(permission)
        db.flush()
        role.permissions = [RolePermission(permission=permission)]
        db.commit()
        role_id, permission_id = role.id, permission.id
        for email, first_name in (
            (actor_email, "Actor"),
            (target_email, "Target"),
            (student_email, "Student"),
        ):
            assigned_roles = [role_name] if email == actor_email else ["student"]
            user = create_user(
                db,
                UserCreate(
                    email=email,
                    full_name=f"{first_name} Lookup",
                    password="E2E-password-123",
                    roles=assigned_roles,
                    first_name=first_name,
                    last_name="Lookup",
                    identification_number=f"E2E-{suffix}-{first_name}",
                    birth_date="2000-01-15",
                    phone="+573001112233",
                ),
            )
            user_ids.append(user.id)
    try:
        with TestClient(app, base_url="http://localhost") as client:
            allowed = client.post(
                "/api/v1/auth/login",
                json={"email": actor_email, "password": "E2E-password-123"},
            )
            assert allowed.status_code == 200, allowed.text
            result = client.get(
                "/api/v1/users/lookup",
                params={"role": "student", "search": "Target"},
            )
            assert result.status_code == 200, result.text
            assert result.json()[0]["email"] == target_email
            assert set(result.json()[0]) == {"id", "display_name", "email", "role"}

            denied = TestClient(app, base_url="http://localhost")
            denied_login = denied.post(
                "/api/v1/auth/login",
                json={"email": student_email, "password": "E2E-password-123"},
            )
            assert denied_login.status_code == 200, denied_login.text
            denied_response = denied.get(
                "/api/v1/users/lookup",
                params={"role": "student", "search": "Target"},
            )
            assert denied_response.status_code == 403, denied_response.text
    finally:
        with SessionLocal() as db:
            for user_id in user_ids:
                user = db.get(User, user_id)
                if user is not None:
                    db.delete(user)
            db.flush()
            if role_id is not None:
                role = db.get(Role, role_id)
                if role is not None:
                    db.delete(role)
            if permission_created and permission_id is not None:
                permission = db.get(Permission, permission_id)
                if permission is not None:
                    db.delete(permission)
            db.commit()
