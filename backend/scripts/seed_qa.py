"""Idempotent QA seed for an explicitly selected universidad_qa database."""

from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import date

from app.core.database import Base
from app.core.security import hash_password
from app.enrollments import models as enrollment_models  # noqa: F401
from app.grades import models as grade_models  # noqa: F401
from app.subjects import models as subject_models  # noqa: F401
from app.users.models import (
    Permission,
    Role,
    RolePermission,
    User,
    UserProfile,
    UserRole,
)
from sqlalchemy import create_engine, select, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

EXPECTED_DATABASE = "universidad_qa"

PERMISSIONS = {
    "users.manage": "Manage users",
    "roles.manage": "Manage roles and permissions",
    "subjects.manage": "Manage subjects",
    "enrollments.manage": "Manage enrollments",
    "grades.manage": "Manage grades",
}

ROLES = {
    "administrator": "QA administrator role",
    "teacher": "QA teacher role",
}


@dataclass(frozen=True)
class QaUser:
    email: str
    password: str
    full_name: str
    first_name: str
    last_name: str
    identification_number: str
    birth_date: date
    phone: str
    role_name: str


def required_environment(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def read_users() -> tuple[QaUser, QaUser]:
    return (
        QaUser(
            email=os.environ.get("QA_ADMIN_EMAIL", "qa-admin@qa-universidad.com")
            .strip()
            .lower(),
            password=required_environment("QA_ADMIN_PASSWORD"),
            full_name="QA Administrator",
            first_name="QA",
            last_name="Administrator",
            identification_number="QA-ADMIN-001",
            birth_date=date(1990, 1, 1),
            phone="+573000000001",
            role_name="administrator",
        ),
        QaUser(
            email=os.environ.get("QA_TEACHER_EMAIL", "qa-teacher@qa-universidad.com")
            .strip()
            .lower(),
            password=required_environment("QA_TEACHER_PASSWORD"),
            full_name="QA Teacher",
            first_name="QA",
            last_name="Teacher",
            identification_number="QA-TEACHER-001",
            birth_date=date(1990, 1, 2),
            phone="+573000000002",
            role_name="teacher",
        ),
    )


def ensure_roles_and_permissions(db: Session) -> dict[str, Role]:
    roles: dict[str, Role] = {}
    for name, description in ROLES.items():
        role = db.scalar(select(Role).where(Role.name == name))
        if role is None:
            role = Role(name=name, description=description, is_active=True)
            db.add(role)
            db.flush()
        elif not role.is_active:
            role.is_active = True
        roles[name] = role

    permissions: dict[str, Permission] = {}
    for name, description in PERMISSIONS.items():
        permission = db.scalar(select(Permission).where(Permission.name == name))
        if permission is None:
            permission = Permission(name=name, description=description, is_active=True)
            db.add(permission)
            db.flush()
        elif not permission.is_active:
            permission.is_active = True
        permissions[name] = permission

    administrator = roles["administrator"]
    teacher = roles["teacher"]
    teacher_managed_permissions = {
        item.permission.name
        for item in teacher.permissions
        if item.permission.name in PERMISSIONS
        and item.permission.name != "grades.manage"
    }
    if teacher_managed_permissions:
        conflicts = ", ".join(sorted(teacher_managed_permissions))
        raise RuntimeError(
            f"Teacher role has conflicting managed permissions: {conflicts}"
        )
    for permission_name in PERMISSIONS:
        if not any(
            item.permission_id == permissions[permission_name].id
            for item in administrator.permissions
        ):
            administrator.permissions.append(
                RolePermission(permission=permissions[permission_name])
            )
    if not any(
        item.permission_id == permissions["grades.manage"].id
        for item in teacher.permissions
    ):
        teacher.permissions.append(
            RolePermission(permission=permissions["grades.manage"])
        )
    return roles


def ensure_user(db: Session, data: QaUser, role: Role) -> User:
    existing_profile = db.scalar(
        select(UserProfile).where(
            UserProfile.identification_number == data.identification_number
        )
    )
    user = db.scalar(select(User).where(User.email == data.email))
    if (
        existing_profile is not None
        and user is not None
        and existing_profile.user_id != user.id
    ):
        raise RuntimeError(
            f"Identification number conflict for QA account {data.email}"
        )
    if user is None and existing_profile is not None:
        raise RuntimeError(
            f"Identification number conflict for QA account {data.email}"
        )
    if user is not None and user.profile is None:
        raise RuntimeError(f"Email conflict for QA account {data.email}")
    if (
        user is not None
        and user.profile.identification_number != data.identification_number
    ):
        raise RuntimeError(f"Email conflict for QA account {data.email}")
    if user is not None and (
        user.full_name != data.full_name
        or user.profile.first_name != data.first_name
        or user.profile.last_name != data.last_name
        or user.profile.birth_date != data.birth_date
        or user.profile.phone != data.phone
    ):
        raise RuntimeError(f"Identity conflict for QA account {data.email}")

    if user is None:
        user = User(
            email=data.email,
            full_name=data.full_name,
            password_hash=hash_password(data.password),
            is_active=True,
        )
        db.add(user)
        db.flush()
    else:
        user.is_active = True

    profile = user.profile
    if profile is None:
        user.profile = UserProfile(
            first_name=data.first_name,
            last_name=data.last_name,
            identification_number=data.identification_number,
            birth_date=data.birth_date,
            phone=data.phone,
        )
    if not any(item.role_id == role.id for item in user.roles):
        user.roles.append(UserRole(role=role))
    return user


def main() -> None:
    database_url = required_environment("DATABASE_URL")
    if make_url(database_url).database != EXPECTED_DATABASE:
        raise RuntimeError(
            f"Refusing seed: DATABASE_URL must target {EXPECTED_DATABASE}"
        )

    engine = create_engine(database_url, pool_pre_ping=True)
    with engine.connect() as connection:
        current_database = connection.execute(
            text("SELECT current_database()")
        ).scalar_one()
        if current_database != EXPECTED_DATABASE:
            raise RuntimeError(
                f"Refusing seed: connected to {current_database}, "
                f"expected {EXPECTED_DATABASE}"
            )
        missing_tables = sorted(
            set(Base.metadata.tables)
            - set(
                connection.execute(
                    text(
                        "SELECT table_name FROM information_schema.tables "
                        "WHERE table_schema = 'public' AND table_type = 'BASE TABLE'"
                    )
                ).scalars()
            )
        )
        if missing_tables:
            raise RuntimeError(f"Missing ORM tables: {', '.join(missing_tables)}")

    users = read_users()
    seeded_summary: list[tuple[str, str]] = []
    with Session(engine, expire_on_commit=False) as db, db.begin():
        roles = ensure_roles_and_permissions(db)
        seeded_users = [ensure_user(db, data, roles[data.role_name]) for data in users]
        seeded_summary = [
            (user.email, data.role_name) for user, data in zip(seeded_users, users)
        ]

    print(f"Seeded {len(seeded_users)} QA accounts in {EXPECTED_DATABASE}.")
    for email, role_name in seeded_summary:
        print(f"- {email}: active account with role {role_name}")


if __name__ == "__main__":
    main()
