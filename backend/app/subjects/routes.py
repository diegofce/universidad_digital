"""Subject REST endpoints."""

from typing import Annotated

from app.core.database import get_db
from app.core.dependencies import csrf_protection, current_user, require_permissions
from app.subjects import services
from app.subjects.schemas import SubjectCreate, SubjectResponse, SubjectUpdate
from app.users.models import User
from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

router = APIRouter(
    prefix="/subjects", tags=["subjects"], dependencies=[Depends(csrf_protection)]
)
Db = Annotated[Session, Depends(get_db)]
Reader = Annotated[User, Depends(current_user)]
Admin = Annotated[User, Depends(require_permissions("subjects.manage"))]


@router.post("/", response_model=SubjectResponse, status_code=201)
def create(data: SubjectCreate, db: Db, _: Admin) -> SubjectResponse:
    return services.create_subject(db, data)


@router.get("/", response_model=list[SubjectResponse])
def list_all(db: Db, _: Reader) -> list[SubjectResponse]:
    reader = _
    role_names = {role.role_name for role in reader.roles}
    teacher_id = reader.id if "teacher" in role_names else None
    return services.list_subjects(db, teacher_id, "administrator" in role_names)


@router.get("/{item_id}", response_model=SubjectResponse)
def get_one(item_id: int, db: Db, _: Reader) -> SubjectResponse:
    reader = _
    role_names = {role.role_name for role in reader.roles}
    teacher_id = reader.id if "teacher" in role_names else None
    return services.get_subject(db, item_id, teacher_id, "administrator" in role_names)


@router.put("/{item_id}", response_model=SubjectResponse)
def update(item_id: int, data: SubjectUpdate, db: Db, _: Admin) -> SubjectResponse:
    return services.update_subject(db, item_id, data)


@router.delete("/{item_id}", status_code=204)
def delete(item_id: int, db: Db, _: Admin) -> Response:
    services.delete_subject(db, item_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
