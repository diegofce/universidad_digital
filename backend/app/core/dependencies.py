"""Reusable authentication and authorization dependencies."""

import secrets
from collections.abc import Callable
from typing import Annotated

import jwt
from app.core.config import settings
from app.core.database import get_db
from app.users.models import Permission, Role, RolePermission, User, UserRole
from fastapi import Depends, Header, HTTPException, Request, status
from jwt import InvalidTokenError
from sqlalchemy import select
from sqlalchemy.orm import Session

DbSession = Annotated[Session, Depends(get_db)]


def current_user(request: Request, db: DbSession) -> User:
    """Resolve an active user from the HttpOnly access-token cookie."""
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required"
        )
    try:
        subject = jwt.decode(
            token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm]
        ).get("sub")
    except InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication"
        ) from exc
    user = db.scalar(
        select(User).where(User.email == subject, User.is_active.is_(True))
    )
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication"
        )
    return user


def require_roles(*roles: str) -> Callable[..., User]:
    """Create a dependency that limits an operation to named roles."""

    def check(user: Annotated[User, Depends(current_user)], db: DbSession) -> User:
        actual = set(
            db.scalars(
                select(Role.name)
                .join(UserRole, UserRole.role_id == Role.id)
                .where(UserRole.user_id == user.id, Role.is_active.is_(True))
            )
        )
        if not actual.intersection(roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions"
            )
        return user

    return check


def require_permissions(*permissions: str) -> Callable[..., User]:
    """Create a dependency requiring at least one active database permission."""

    def check(user: Annotated[User, Depends(current_user)], db: DbSession) -> User:
        actual = set(
            db.scalars(
                select(Permission.name)
                .join(RolePermission, RolePermission.permission_id == Permission.id)
                .join(UserRole, UserRole.role_id == RolePermission.role_id)
                .where(
                    UserRole.user_id == user.id,
                    Permission.is_active.is_(True),
                )
            )
        )
        if not actual.intersection(permissions):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions"
            )
        return user

    return check


def csrf_protection(
    request: Request,
    csrf_token: str | None = Header(default=None, alias="X-CSRF-Token"),
) -> None:
    """Validate the double-submit CSRF token for state-changing requests."""
    if request.method in {"GET", "HEAD", "OPTIONS"} or request.url.path.endswith(
        "/auth/login"
    ):
        return
    cookie_token = request.cookies.get("csrf_token")
    if (
        not cookie_token
        or not csrf_token
        or not secrets.compare_digest(cookie_token, csrf_token)
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="CSRF validation failed"
        )
