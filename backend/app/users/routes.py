"""User REST endpoints."""

from typing import Annotated

from app.core.database import get_db
from app.core.dependencies import csrf_protection, require_permissions
from app.users import services
from app.users.models import User
from app.users.schemas import (
    PermissionCreate,
    PermissionResponse,
    PermissionUpdate,
    RoleCreate,
    RolePermissionUpdate,
    RoleResponse,
    RoleUpdate,
    UserCreate,
    UserResponse,
    UserUpdate,
)
from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

router = APIRouter(
    prefix="/users", tags=["users"], dependencies=[Depends(csrf_protection)]
)
Admin = Annotated[User, Depends(require_permissions("users.manage"))]
RoleAdmin = Annotated[User, Depends(require_permissions("roles.manage"))]
Db = Annotated[Session, Depends(get_db)]


@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create(data: UserCreate, db: Db, _: Admin) -> User:
    return services.create_user(db, data, _.id)


@router.get("/roles", response_model=list[RoleResponse])
def list_roles(db: Db, _: RoleAdmin) -> list[RoleResponse]:
    return services.list_roles(db)


@router.post("/roles", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
def create_role(data: RoleCreate, db: Db, _: RoleAdmin) -> RoleResponse:
    return services.create_role(db, data, _.id)


@router.put("/roles/{role_id}", response_model=RoleResponse)
def update_role(role_id: int, data: RoleUpdate, db: Db, _: RoleAdmin) -> RoleResponse:
    return services.update_role(db, role_id, data, _.id)


@router.put("/roles/{role_id}/permissions", response_model=RoleResponse)
def update_role_permissions(
    role_id: int, data: RolePermissionUpdate, db: Db, _: RoleAdmin
) -> RoleResponse:
    return services.set_role_permissions(db, role_id, data, _.id)


@router.get("/permissions", response_model=list[PermissionResponse])
def list_permissions(db: Db, _: RoleAdmin) -> list[PermissionResponse]:
    return services.list_permissions(db)


@router.post(
    "/permissions",
    response_model=PermissionResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_permission(
    data: PermissionCreate, db: Db, _: RoleAdmin
) -> PermissionResponse:
    return services.create_permission(db, data, _.id)


@router.put("/permissions/{permission_id}", response_model=PermissionResponse)
def update_permission(
    permission_id: int, data: PermissionUpdate, db: Db, _: RoleAdmin
) -> PermissionResponse:
    return services.update_permission(db, permission_id, data, _.id)


@router.get("/", response_model=list[UserResponse])
def list_all(
    db: Db,
    _: Admin,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=100),
) -> list[User]:
    return services.list_users(db, offset, limit)


@router.get("/{user_id}", response_model=UserResponse)
def get_one(user_id: int, db: Db, _: Admin) -> User:
    return services.get_user(db, user_id)


@router.put("/{user_id}", response_model=UserResponse)
def update(user_id: int, data: UserUpdate, db: Db, _: Admin) -> User:
    return services.update_user(db, user_id, data, _.id)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete(user_id: int, db: Db, _: Admin) -> Response:
    services.deactivate_user(db, user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
