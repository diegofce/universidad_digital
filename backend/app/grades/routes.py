"""Grade REST endpoints."""

from typing import Annotated

from app.core.database import get_db
from app.core.dependencies import csrf_protection, current_user, require_permissions
from app.core.errors import AppError
from app.grades import services
from app.grades.schemas import (
    GradeCreate,
    GradeResponse,
    GradeSummaryResponse,
    GradeUpdate,
)
from app.users.models import User
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

router = APIRouter(
    prefix="/grades", tags=["grades"], dependencies=[Depends(csrf_protection)]
)
Db = Annotated[Session, Depends(get_db)]
Actor = Annotated[User, Depends(current_user)]
Staff = Annotated[User, Depends(require_permissions("grades.manage"))]


@router.post("/", response_model=GradeResponse, status_code=201)
def create(data: GradeCreate, db: Db, actor: Staff) -> GradeResponse:
    roles = {role.role_name for role in actor.roles}
    if not roles.intersection({"administrator", "teacher"}):
        raise AppError("Insufficient permissions", 403)
    return services.create_grade(
        db,
        data,
        teacher_id=actor.id if "teacher" in roles else None,
        admin="administrator" in roles,
    )


@router.get("/", response_model=list[GradeResponse])
def list_all(db: Db, actor: Actor) -> list[GradeResponse]:
    roles = {role.role_name for role in actor.roles}
    if "administrator" in roles:
        return services.list_grades(db)
    if "teacher" in roles:
        return services.list_grades(db, teacher_id=actor.id)
    return services.list_grades(db, actor.id)


@router.get("/summary/{student_id}", response_model=GradeSummaryResponse)
def summary(
    student_id: int,
    db: Db,
    actor: Actor,
    period_id: int | None = Query(default=None, gt=0),
) -> GradeSummaryResponse:
    """Return a credit-weighted average within the caller's scope."""
    roles = {role.role_name for role in actor.roles}
    if "student" in roles and student_id != actor.id:
        raise AppError("Grade summary not found", 404)
    teacher_id = (
        actor.id if "teacher" in roles and "administrator" not in roles else None
    )
    average = services.calculate_weighted_average(db, student_id, period_id, teacher_id)
    return GradeSummaryResponse(
        student_id=student_id, period_id=period_id, weighted_average=average
    )


@router.get("/{item_id}", response_model=GradeResponse)
def get_one(item_id: int, db: Db, actor: Actor) -> GradeResponse:
    roles = {role.role_name for role in actor.roles}
    return services.get_grade(
        db,
        item_id,
        actor_id=actor.id,
        teacher_id=actor.id if "teacher" in roles else None,
        admin="administrator" in roles,
    )


@router.put("/{item_id}", response_model=GradeResponse)
def update(item_id: int, data: GradeUpdate, db: Db, actor: Staff) -> GradeResponse:
    roles = {role.role_name for role in actor.roles}
    if not roles.intersection({"administrator", "teacher"}):
        raise AppError("Insufficient permissions", 403)
    return services.update_grade(
        db,
        item_id,
        data,
        teacher_id=actor.id if "teacher" in roles else None,
        admin="administrator" in roles,
    )


@router.delete("/{item_id}", status_code=204)
def delete(
    item_id: int,
    db: Db,
    _: Annotated[User, Depends(require_permissions("grades.manage"))],
) -> Response:
    services.delete_grade(db, item_id)
    return Response(status_code=204)
