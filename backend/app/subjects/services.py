"""Subject business operations."""

from app.core.errors import AppError
from app.subjects.models import Subject
from app.subjects.schemas import SubjectCreate, SubjectUpdate
from app.users.models import Role, User, UserRole
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session


def _validate_teacher(db: Session, teacher_id: int | None) -> None:
    """Ensure an assigned account exists and has the teacher role."""
    if teacher_id is None:
        return
    teacher = db.get(User, teacher_id)
    if teacher is None or not teacher.is_active:
        raise AppError("Teacher not found", 404)
    role = db.scalar(
        select(Role)
        .join(UserRole, UserRole.role_id == Role.id)
        .where(
            UserRole.user_id == teacher_id,
            Role.name == "teacher",
            Role.is_active.is_(True),
        )
    )
    if role is None:
        raise AppError("User is not a teacher", 422)


def create_subject(db: Session, data: SubjectCreate) -> Subject:
    """Create a unique subject."""
    _validate_teacher(db, data.teacher_id)
    item = Subject(**data.model_dump())
    db.add(item)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise AppError("Subject code already exists", 409) from exc
    db.refresh(item)
    return item


def get_subject(
    db: Session,
    item_id: int,
    teacher_id: int | None = None,
    include_inactive: bool = False,
) -> Subject:
    """Fetch subject by identifier."""
    item = db.get(Subject, item_id)
    if item is None:
        raise AppError("Subject not found", 404)
    if not include_inactive and not item.is_active:
        raise AppError("Subject not found", 404)
    if teacher_id is not None and item.teacher_id != teacher_id:
        raise AppError("Subject not found", 404)
    return item


def list_subjects(
    db: Session,
    teacher_id: int | None = None,
    include_inactive: bool = False,
) -> list[Subject]:
    """List subjects in stable order."""
    query = select(Subject).order_by(Subject.id)
    if teacher_id is not None:
        query = query.where(Subject.teacher_id == teacher_id)
    if not include_inactive:
        query = query.where(Subject.is_active.is_(True))
    return list(db.scalars(query).all())


def update_subject(db: Session, item_id: int, data: SubjectUpdate) -> Subject:
    """Update provided subject fields."""
    values = data.model_dump(exclude_unset=True)
    _validate_teacher(db, values.get("teacher_id"))
    item = get_subject(db, item_id)
    for field, value in values.items():
        setattr(item, field, value)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise AppError("Subject code already exists", 409) from exc
    db.refresh(item)
    return item


def delete_subject(db: Session, item_id: int) -> None:
    """Deactivate a subject while preserving academic history."""
    item = get_subject(db, item_id, include_inactive=True)
    item.is_active = False
    db.commit()
