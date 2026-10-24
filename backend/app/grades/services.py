"""Grade use cases and persistence operations."""

from app.core.errors import AppError
from app.enrollments.models import Enrollment
from app.grades.models import Grade
from app.grades.schemas import GradeCreate, GradeUpdate
from app.subjects.models import Subject
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session


def create_grade(
    db: Session,
    data: GradeCreate,
    teacher_id: int | None = None,
    admin: bool = False,
) -> Grade:
    """Create a grade within the administrator or assigned teacher scope."""
    enrollment = db.get(Enrollment, data.enrollment_id)
    if enrollment is None:
        raise AppError("Enrollment not found", 404)
    if not admin and (
        teacher_id is None or enrollment.subject.teacher_id != teacher_id
    ):
        raise AppError("Teacher is not assigned to this subject", 403)
    item = Grade(**data.model_dump())
    db.add(item)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise AppError("Unable to create grade", 409) from exc
    db.refresh(item)
    return item


def get_grade(
    db: Session,
    item_id: int,
    actor_id: int | None = None,
    teacher_id: int | None = None,
    admin: bool = False,
) -> Grade:
    """Fetch a grade by identifier."""
    item = db.get(Grade, item_id)
    if item is None:
        raise AppError("Grade not found", 404)
    if not admin:
        owns_grade = actor_id is not None and item.enrollment.student_id == actor_id
        teaches_subject = (
            teacher_id is not None and item.enrollment.subject.teacher_id == teacher_id
        )
        if not owns_grade and not teaches_subject:
            raise AppError("Grade not found", 404)
    return item


def list_grades(
    db: Session,
    student_id: int | None = None,
    teacher_id: int | None = None,
) -> list[Grade]:
    """List grades scoped to a student or assigned teacher."""
    query = select(Grade).join(Enrollment).order_by(Grade.id)
    if student_id is not None:
        query = query.where(Enrollment.student_id == student_id)
    if teacher_id is not None:
        query = query.join(Subject).where(Subject.teacher_id == teacher_id)
    return list(db.scalars(query).all())


def calculate_weighted_average(
    db: Session,
    student_id: int,
    period_id: int | None = None,
    teacher_id: int | None = None,
) -> object | None:
    """Calculate an average weighted by the credits of each subject."""
    query = (
        select(
            func.sum(Grade.score * Subject.credits)
            / func.nullif(func.sum(Subject.credits), 0)
        )
        .join(Enrollment, Grade.enrollment_id == Enrollment.id)
        .join(Subject, Enrollment.subject_id == Subject.id)
        .where(
            Enrollment.student_id == student_id,
            Enrollment.status != "cancelled",
        )
    )
    if period_id is not None:
        query = query.where(Enrollment.period_id == period_id)
    if teacher_id is not None:
        query = query.where(Subject.teacher_id == teacher_id)
    return db.scalar(query)


def update_grade(
    db: Session,
    item_id: int,
    data: GradeUpdate,
    teacher_id: int | None = None,
    admin: bool = False,
) -> Grade:
    """Update grade fields."""
    item = get_grade(db, item_id, teacher_id=teacher_id, admin=admin)
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(item, key, value)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise AppError("Unable to update grade", 409) from exc
    db.refresh(item)
    return item


def delete_grade(db: Session, item_id: int) -> None:
    """Delete an assessment grade."""
    db.delete(get_grade(db, item_id))
    db.commit()
