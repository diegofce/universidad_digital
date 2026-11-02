"""Business-rule tests for user, role and permission services."""

from datetime import date

import pytest
from app.core.errors import AppError
from app.core.security import verify_password
from app.users.models import (
    Permission,
    Role,
    RoleAudit,
    User,
    UserProfile,
    UserRole,
)
from app.users.schemas import (
    PermissionCreate,
    PermissionUpdate,
    RoleCreate,
    RolePermissionUpdate,
    RoleUpdate,
    UserCreate,
    UserUpdate,
)
from app.users.services import (
    create_permission,
    create_role,
    create_user,
    deactivate_user,
    get_user,
    list_permissions,
    list_roles,
    list_users,
    lookup_users,
    set_role_permissions,
    update_permission,
    update_role,
    update_user,
)
from sqlalchemy import select


def user_data(
    *,
    email: str = "new@example.com",
    roles: list[str] | None = None,
    identification_number: str | None = None,
):
    return UserCreate(
        email=email,
        full_name="New Student",
        password="a-long-test-password",
        roles=roles or [],
        first_name="New",
        last_name="Student",
        identification_number=identification_number or f"ID-{email.split('@')[0]}",
        birth_date=date(2001, 2, 3),
        phone="+573001234567",
    )


@pytest.mark.integration
def test_create_user_normalizes_email_hashes_password_and_audits_roles(
    db_session, seeded_roles, valid_user
):
    created = create_user(
        db_session,
        user_data(email="NEW@example.com", roles=["student"]),
        valid_user.id,
    )

    assert created.email == "new@example.com"
    assert verify_password("a-long-test-password", created.password_hash)
    assert created.profile.identification_number == "ID-NEW"
    audit = db_session.scalar(select(RoleAudit).where(RoleAudit.action == "user.roles.created"))
    assert audit.actor_user_id == valid_user.id
    assert audit.details == f"user_id={created.id}"


@pytest.mark.integration
def test_create_user_without_roles_does_not_create_role_audit(db_session):
    created = create_user(db_session, user_data())

    assert created.id is not None
    assert db_session.scalar(select(RoleAudit)) is None


@pytest.mark.integration
def test_create_user_rejects_unknown_role_and_duplicate_identity(db_session, seeded_roles):
    with pytest.raises(AppError, match="roles do not exist") as missing_role:
        create_user(db_session, user_data(roles=["unknown"]))
    assert missing_role.value.status_code == 422

    create_user(db_session, user_data(email="first@example.com"))
    with pytest.raises(AppError, match="already registered") as duplicate_email:
        create_user(db_session, user_data(email="FIRST@example.com"))
    assert duplicate_email.value.status_code == 409

    with pytest.raises(AppError, match="already registered") as duplicate_id:
        create_user(
            db_session,
            user_data(email="other@example.com", identification_number="ID-first"),
        )
    assert duplicate_id.value.status_code == 409


@pytest.mark.integration
def test_get_and_list_users_and_lookup_filters_active_role_matches(
    db_session, valid_user, seeded_roles
):
    teacher = User(
        email="teacher@example.com",
        full_name="Teacher Example",
        password_hash="not-used",
        profile=UserProfile(
            first_name="Taylor",
            last_name="Teacher",
            identification_number="TEACHER-001",
            birth_date=date(1980, 1, 1),
            phone="+573001111111",
        ),
        roles=[UserRole(role=seeded_roles["teacher"])],
    )
    inactive_role = Role(name="archived", description="Archived", is_active=False)
    inactive_user = User(
        email="inactive@example.com",
        full_name="Inactive Person",
        password_hash="not-used",
        roles=[UserRole(role=seeded_roles["teacher"])],
        is_active=False,
    )
    inactive_role_user = User(
        email="archived@example.com",
        full_name="Archived Role",
        password_hash="not-used",
        roles=[UserRole(role=inactive_role)],
    )
    db_session.add_all([teacher, inactive_user, inactive_role_user])
    db_session.commit()

    assert get_user(db_session, valid_user.id).email == valid_user.email
    assert [item.id for item in list_users(db_session, offset=1, limit=1)] == [teacher.id]
    matches = lookup_users(db_session, "teacher", "  Taylor ")
    assert [item.email for item in matches] == ["teacher@example.com"]
    assert lookup_users(db_session, "student", "no-match") == []
    with pytest.raises(AppError, match="User not found") as missing:
        get_user(db_session, 9999)
    assert missing.value.status_code == 404


@pytest.mark.integration
def test_update_user_partial_profile_and_role_audit(db_session, valid_user, seeded_roles):
    updated = update_user(
        db_session,
        valid_user.id,
        UserUpdate(
            email="UPDATED@EXAMPLE.COM",
            password="another-long-password",
            first_name="Augusta",
            roles=["teacher"],
        ),
        actor_user_id=valid_user.id,
    )

    assert updated.email == "updated@example.com"
    assert verify_password("another-long-password", updated.password_hash)
    assert updated.profile.first_name == "Augusta"
    assert [role.role_name for role in updated.roles] == ["teacher"]
    audit = db_session.scalar(select(RoleAudit).where(RoleAudit.action == "user.roles.updated"))
    assert audit.actor_user_id == valid_user.id


@pytest.mark.integration
def test_update_user_creates_missing_profile_only_when_complete(db_session):
    user = User(email="bare@example.com", full_name="Bare", password_hash="hash")
    db_session.add(user)
    db_session.commit()

    with pytest.raises(AppError, match="Complete the personal profile") as incomplete:
        update_user(db_session, user.id, UserUpdate(first_name="Only one field"))
    assert incomplete.value.status_code == 422

    updated = update_user(
        db_session,
        user.id,
        UserUpdate(
            first_name="Ada",
            last_name="Lovelace",
            identification_number="BARE-001",
            birth_date=date(1815, 12, 10),
            phone="+573001234567",
        ),
    )
    assert updated.profile.first_name == "Ada"
    assert updated.profile.last_name == "Lovelace"


@pytest.mark.integration
def test_update_user_handles_unknown_role_duplicate_identity_and_missing_user(
    db_session, valid_user, seeded_roles
):
    create_user(db_session, user_data(email="other@example.com"))
    with pytest.raises(AppError, match="roles do not exist"):
        update_user(db_session, valid_user.id, UserUpdate(roles=["unknown"]))
    with pytest.raises(AppError, match="already registered") as duplicate:
        update_user(db_session, valid_user.id, UserUpdate(email="other@example.com"))
    assert duplicate.value.status_code == 409
    with pytest.raises(AppError, match="User not found"):
        update_user(db_session, 9999, UserUpdate(full_name="Missing"))


@pytest.mark.integration
def test_deactivate_user_is_soft_and_missing_user_is_reported(db_session, valid_user):
    assert deactivate_user(db_session, valid_user.id) is None
    assert db_session.get(User, valid_user.id).is_active is False
    with pytest.raises(AppError, match="User not found"):
        deactivate_user(db_session, 9999)


@pytest.mark.integration
def test_role_lifecycle_and_audit_errors(db_session, valid_user):
    assert {role.name for role in list_roles(db_session)} == {
        "student", "teacher", "administrator"
    }
    role = create_role(
        db_session, RoleCreate(name="qa.reader", description="Reader"), valid_user.id
    )
    assert role.name == "qa.reader"
    assert db_session.scalar(select(RoleAudit).where(RoleAudit.action == "role.created"))
    with pytest.raises(AppError, match="Role already exists") as duplicate:
        create_role(
            db_session, RoleCreate(name="qa.reader", description="Again"), valid_user.id
        )
    assert duplicate.value.status_code == 409

    role = update_role(
        db_session, role.id, RoleUpdate(description="Updated"), valid_user.id
    )
    assert role.description == "Updated"
    assert db_session.scalar(select(RoleAudit).where(RoleAudit.action == "role.updated"))
    with pytest.raises(AppError, match="Role not found"):
        update_role(db_session, 9999, RoleUpdate(description="Missing"), valid_user.id)

    create_role(
        db_session, RoleCreate(name="qa.other", description="Other"), valid_user.id
    )
    with pytest.raises(AppError, match="Role name already exists") as duplicate_name:
        update_role(
            db_session, role.id, RoleUpdate(name="qa.other"), valid_user.id
        )
    assert duplicate_name.value.status_code == 409


@pytest.mark.integration
def test_permission_lifecycle_and_role_permission_replacement(
    db_session, seeded_roles, valid_user
):
    assert {permission.name for permission in list_permissions(db_session)} == {
        "subjects.manage",
        "enrollments.manage",
        "grades.manage",
        "users.manage",
        "roles.manage",
    }
    role = seeded_roles["student"]
    permission = create_permission(
        db_session,
        PermissionCreate(name="reports.view", description="View reports"),
        valid_user.id,
    )
    assert permission.name == "reports.view"
    assert db_session.scalar(
        select(RoleAudit).where(RoleAudit.action == "permission.created")
    )
    with pytest.raises(AppError, match="Permission already exists") as duplicate:
        create_permission(
            db_session,
            PermissionCreate(name="reports.view", description="Duplicate"),
            valid_user.id,
        )
    assert duplicate.value.status_code == 409

    permission = update_permission(
        db_session,
        permission.id,
        PermissionUpdate(description="Updated"),
        valid_user.id,
    )
    assert permission.description == "Updated"
    assert db_session.scalar(
        select(RoleAudit).where(RoleAudit.action == "permission.updated")
    )
    db_session.add(Permission(name="taken.name", description="Taken"))
    db_session.commit()
    with pytest.raises(AppError, match="Permission name already exists") as duplicate_name:
        update_permission(
            db_session,
            permission.id,
            PermissionUpdate(name="taken.name"),
            valid_user.id,
        )
    assert duplicate_name.value.status_code == 409
    with pytest.raises(AppError, match="Permission not found"):
        update_permission(
            db_session, 9999, PermissionUpdate(description="Missing"), valid_user.id
        )

    updated_role = set_role_permissions(
        db_session,
        role.id,
        RolePermissionUpdate(permissions=["subjects.manage", "reports.view"]),
        valid_user.id,
    )
    assert {item.permission.name for item in updated_role.permissions} == {
        "subjects.manage", "reports.view"
    }
    set_role_permissions(db_session, role.id, RolePermissionUpdate(), valid_user.id)
    assert updated_role.permissions == []
    with pytest.raises(AppError, match="permissions do not exist") as missing_permission:
        set_role_permissions(
            db_session,
            role.id,
            RolePermissionUpdate(permissions=["missing.permission"]),
            valid_user.id,
        )
    assert missing_permission.value.status_code == 422
    with pytest.raises(AppError, match="Role not found"):
        set_role_permissions(db_session, 9999, RolePermissionUpdate(), valid_user.id)
