"""Shared, isolated test infrastructure for the Universidad Digital API."""

from __future__ import annotations

import os
from collections.abc import Generator
from datetime import date

os.environ.setdefault("DATABASE_URL", "sqlite:///./test-import.db")
os.environ.setdefault("APP_JWT_SECRET", "test-secret-key-with-at-least-32-chars")
os.environ.setdefault("APP_ENV", "development")
os.environ.setdefault("APP_COOKIE_SECURE", "false")

import pytest
from app.core.database import Base, get_db
from app.core.security import hash_password
from app.enrollments.models import AcademicPeriod, Enrollment
from app.grades.models import Grade
from app.main import app
from app.subjects.models import Subject
from app.users.models import (
    Permission,
    Role,
    RolePermission,
    User,
    UserProfile,
    UserRole,
)
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

_MODEL_TYPES = (AcademicPeriod, Enrollment, Grade, Subject, User, UserProfile)


@pytest.fixture(scope="session")
def sqlite_engine():
    """Use one in-memory connection per test session; schemas are recreated per test."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def enable_foreign_keys(dbapi_connection, _connection_record):
        dbapi_connection.execute("PRAGMA foreign_keys=ON")

    yield engine
    engine.dispose()


@pytest.fixture()
def db_session(sqlite_engine) -> Generator[Session, None, None]:
    """Provide a clean transaction boundary and schema for every test."""
    Base.metadata.create_all(sqlite_engine)
    session_factory = sessionmaker(
        bind=sqlite_engine, autoflush=False, expire_on_commit=False
    )
    session = session_factory()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(sqlite_engine)


@pytest.fixture()
def api_client(db_session: Session) -> Generator[TestClient, None, None]:
    """Route API database access to the isolated SQLite session."""

    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app, base_url="http://localhost")
    try:
        yield client
    finally:
        app.dependency_overrides.clear()


@pytest.fixture()
def seeded_roles(db_session: Session) -> dict[str, Role]:
    """Create the roles and permissions needed by API scenarios."""
    permissions = {
        name: Permission(name=name, description=f"Test permission: {name}")
        for name in (
            "subjects.manage",
            "enrollments.manage",
            "grades.manage",
            "users.manage",
        )
    }
    roles = {
        name: Role(name=name, description=f"Test role: {name}")
        for name in ("student", "teacher", "administrator")
    }
    db_session.add_all([*permissions.values(), *roles.values()])
    db_session.flush()
    roles["teacher"].permissions = [
        RolePermission(permission=permissions["grades.manage"])
    ]
    roles["administrator"].permissions = [
        RolePermission(permission=permission) for permission in permissions.values()
    ]
    db_session.commit()
    return roles


@pytest.fixture()
def valid_user(db_session: Session, seeded_roles: dict[str, Role]) -> User:
    """Create a deterministic student for tests that need a valid account."""
    user = User(
        email="student@example.com",
        full_name="Ada Student",
        password_hash=hash_password("correct-password-123"),
        profile=UserProfile(
            first_name="Ada",
            last_name="Student",
            identification_number="STUDENT-001",
            birth_date=date(2000, 1, 15),
            phone="+573001112233",
        ),
        roles=[UserRole(role=seeded_roles["student"])],
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture()
def invalid_user() -> dict[str, str]:
    """Represent malformed credentials without persisting an invalid entity."""
    return {"email": "not-an-email", "password": "short"}
