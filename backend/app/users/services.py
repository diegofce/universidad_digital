"""User use cases and persistence operations."""

from app.core.errors import AppError
from app.core.security import hash_password
from app.users.models import Permission, Role, RoleAudit, RolePermission, User, UserRole
from app.users.schemas import (
    PermissionCreate,
    PermissionUpdate,
    RoleCreate,
    RolePermissionUpdate,
    RoleUpdate,
    UserCreate,
    UserUpdate,
)
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session


def _roles_by_name(db: Session, names: list[str]) -> list[Role]:
    """Resolve active database roles and reject unknown assignments."""
    if not names:
        return []
    roles = list(
        db.scalars(
            select(Role).where(Role.name.in_(set(names)), Role.is_active.is_(True))
        ).all()
    )
    found = {role.name for role in roles}
    if found != set(names):
        raise AppError("One or more roles do not exist", 422)
    return roles


def _audit(
    db: Session,
    action: str,
    actor_user_id: int | None,
    role_id: int | None = None,
    details: str | None = None,
) -> None:
    """Persist a role administration audit event in the current transaction."""
    db.add(
        RoleAudit(
            action=action,
            actor_user_id=actor_user_id,
            role_id=role_id,
            details=details,
        )
    )


def create_user(
    db: Session, data: UserCreate, actor_user_id: int | None = None
) -> User:
    """Create a user and its validated role associations atomically."""
    roles = _roles_by_name(db, data.roles)
    user = User(
        email=str(data.email).lower(),
        full_name=data.full_name,
        password_hash=hash_password(data.password),
    )
    user.roles = [UserRole(role=role) for role in roles]
    db.add(user)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise AppError("Email is already registered", 409) from exc
    if roles:
        _audit(db, "user.roles.created", actor_user_id, details=f"user_id={user.id}")
        db.commit()
    db.refresh(user)
    return user


def get_user(db: Session, user_id: int) -> User:
    """Fetch one user or return a controlled not-found error."""
    user = db.get(User, user_id)
    if user is None:
        raise AppError("User not found", 404)
    return user


def list_users(db: Session, offset: int = 0, limit: int = 100) -> list[User]:
    """Return a bounded page of users."""
    return list(
        db.scalars(select(User).order_by(User.id).offset(offset).limit(limit)).all()
    )


def update_user(
    db: Session,
    user_id: int,
    data: UserUpdate,
    actor_user_id: int | None = None,
) -> User:
    """Apply explicitly provided user fields."""
    user = get_user(db, user_id)
    values = data.model_dump(exclude_unset=True)
    if values.get("email") is not None:
        values["email"] = str(values["email"]).lower()
    if values.get("password") is not None:
        values["password_hash"] = hash_password(values.pop("password"))
    roles = values.pop("roles", None)
    if roles is not None:
        user.roles = [UserRole(role=role) for role in _roles_by_name(db, roles)]
    for field, value in values.items():
        setattr(user, field, value)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise AppError("Email is already registered", 409) from exc
    if roles is not None:
        _audit(db, "user.roles.updated", actor_user_id, details=f"user_id={user.id}")
        db.commit()
    db.refresh(user)
    return user


def deactivate_user(db: Session, user_id: int) -> None:
    """Soft-delete an account by disabling it."""
    user = get_user(db, user_id)
    user.is_active = False
    db.commit()


def list_roles(db: Session) -> list[Role]:
    """List database-managed roles."""
    return list(db.scalars(select(Role).order_by(Role.name)).all())


def create_role(db: Session, data: RoleCreate, actor_user_id: int) -> Role:
    """Create a role and audit the operation."""
    role = Role(**data.model_dump())
    db.add(role)
    try:
        db.flush()
        _audit(db, "role.created", actor_user_id, role.id)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise AppError("Role already exists", 409) from exc
    db.refresh(role)
    return role


def update_role(
    db: Session, role_id: int, data: RoleUpdate, actor_user_id: int
) -> Role:
    """Update role metadata without changing application code."""
    role = db.get(Role, role_id)
    if role is None:
        raise AppError("Role not found", 404)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(role, field, value)
    try:
        _audit(db, "role.updated", actor_user_id, role.id)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise AppError("Role name already exists", 409) from exc
    db.refresh(role)
    return role


def list_permissions(db: Session) -> list[Permission]:
    """List database-managed permissions."""
    return list(db.scalars(select(Permission).order_by(Permission.name)).all())


def create_permission(
    db: Session, data: PermissionCreate, actor_user_id: int
) -> Permission:
    """Create a permission and audit the operation."""
    permission = Permission(**data.model_dump())
    db.add(permission)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise AppError("Permission already exists", 409) from exc
    db.refresh(permission)
    _audit(
        db,
        "permission.created",
        actor_user_id,
        details=f"permission_id={permission.id}",
    )
    db.commit()
    return permission


def update_permission(
    db: Session, permission_id: int, data: PermissionUpdate, actor_user_id: int
) -> Permission:
    """Update permission metadata."""
    permission = db.get(Permission, permission_id)
    if permission is None:
        raise AppError("Permission not found", 404)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(permission, field, value)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise AppError("Permission name already exists", 409) from exc
    db.refresh(permission)
    _audit(
        db,
        "permission.updated",
        actor_user_id,
        details=f"permission_id={permission.id}",
    )
    db.commit()
    return permission


def set_role_permissions(
    db: Session,
    role_id: int,
    data: RolePermissionUpdate,
    actor_user_id: int,
) -> Role:
    """Replace a role permission set atomically and audit the change."""
    role = db.get(Role, role_id)
    if role is None:
        raise AppError("Role not found", 404)
    permissions = list(
        db.scalars(
            select(Permission).where(
                Permission.name.in_(set(data.permissions)),
                Permission.is_active.is_(True),
            )
        ).all()
    )
    if {permission.name for permission in permissions} != set(data.permissions):
        raise AppError("One or more permissions do not exist", 422)
    role.permissions = [
        RolePermission(permission=permission) for permission in permissions
    ]
    _audit(db, "role.permissions.updated", actor_user_id, role.id)
    db.commit()
    db.refresh(role)
    return role
