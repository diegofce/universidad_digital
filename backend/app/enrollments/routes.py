"""Academic period and enrollment endpoints."""

from typing import Annotated

from app.core.database import get_db
from app.core.dependencies import csrf_protection, current_user, require_permissions
from app.core.errors import AppError
from app.enrollments import services
from app.enrollments.schemas import (
    EnrollmentCreate,
    EnrollmentResponse,
    EnrollmentUpdate,
    PeriodCreate,
    PeriodResponse,
    PeriodUpdate,
)
from app.users.models import User
from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

router = APIRouter(tags=["enrollments"], dependencies=[Depends(csrf_protection)])
Db = Annotated[Session, Depends(get_db)]
Actor = Annotated[User, Depends(current_user)]
Admin = Annotated[User, Depends(require_permissions("enrollments.manage"))]


@router.post("/periods/", response_model=PeriodResponse, status_code=201)
def create_period(data: PeriodCreate, db: Db, _: Admin) -> PeriodResponse:
    return services.create_period(db, data)


@router.get("/periods/", response_model=list[PeriodResponse])
def periods(db: Db, _: Actor) -> list[PeriodResponse]:
    return services.list_periods(db)


@router.put("/periods/{item_id}", response_model=PeriodResponse)
def update_period(item_id: int, data: PeriodUpdate, db: Db, _: Admin) -> PeriodResponse:
    return services.update_period(db, item_id, data)


@router.delete("/periods/{item_id}", status_code=204)
def delete_period(item_id: int, db: Db, _: Admin) -> Response:
    services.delete_period(db, item_id)
    return Response(status_code=204)


@router.post("/enrollments/", response_model=EnrollmentResponse, status_code=201)
def enroll(data: EnrollmentCreate, db: Db, actor: Actor) -> EnrollmentResponse:
    roles = {role.role_name for role in actor.roles}
    if not roles.intersection({"student", "administrator"}):
        raise AppError("Insufficient permissions", 403)
    return services.create_enrollment(
        db, data, None if "administrator" in roles else actor.id
    )


@router.get("/enrollments/", response_model=list[EnrollmentResponse])
def enrollments(db: Db, actor: Actor) -> list[EnrollmentResponse]:
    roles = {role.role_name for role in actor.roles}
    return services.list_enrollments(
        db,
        actor.id,
        "administrator" in roles,
        actor.id if "teacher" in roles else None,
    )


@router.put("/enrollments/{item_id}", response_model=EnrollmentResponse)
def update_enrollment(
    item_id: int, data: EnrollmentUpdate, db: Db, actor: Actor
) -> EnrollmentResponse:
    roles = {role.role_name for role in actor.roles}
    if not roles.intersection({"administrator", "teacher"}):
        raise AppError("Insufficient permissions", 403)
    return services.update_enrollment(
        db,
        item_id,
        data,
        actor.id,
        "administrator" in roles,
        actor.id if "teacher" in roles else None,
    )


@router.delete("/enrollments/{item_id}", status_code=204)
def unenroll(item_id: int, db: Db, actor: Actor) -> Response:
    roles = {role.role_name for role in actor.roles}
    services.delete_enrollment(
        db,
        item_id,
        actor.id,
        "administrator" in roles,
        actor.id if "teacher" in roles else None,
    )
    return Response(status_code=204)
