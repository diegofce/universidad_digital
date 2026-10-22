"""Academic period and enrollment use cases."""

from app.core.config import settings
from app.core.errors import AppError
from app.enrollments.models import AcademicPeriod, Enrollment, EnrollmentStatus
from app.enrollments.schemas import (
    EnrollmentCreate,
    EnrollmentUpdate,
    PeriodCreate,
    PeriodUpdate,
)
from app.subjects.models import Subject
from app.users.models import Role, User, UserRole
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session


def create_period(db: Session, data: PeriodCreate) -> AcademicPeriod:
    """Create a period after checking date ordering."""
    item = AcademicPeriod(**data.model_dump())
    db.add(item)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise AppError("Period name already exists", 409) from exc
    db.refresh(item)
    return item


def get_period(db: Session, item_id: int) -> AcademicPeriod:
    """Fetch an academic period."""
    item = db.get(AcademicPeriod, item_id)
    if item is None:
        raise AppError("Period not found", 404)
    return item


def list_periods(db: Session) -> list[AcademicPeriod]:
    """List periods."""
    return list(
        db.scalars(
            select(AcademicPeriod).order_by(AcademicPeriod.starts_on.desc())
        ).all()
    )


def update_period(db: Session, item_id: int, data: PeriodUpdate) -> AcademicPeriod:
    """Update period and retain valid date ordering."""
    item = get_period(db, item_id)
    values = data.model_dump(exclude_unset=True)
    starts = values.get("starts_on", item.starts_on)
    ends = values.get("ends_on", item.ends_on)
    if starts is not None and ends is not None and ends <= starts:
        raise AppError("Invalid period dates")
    for key, value in values.items():
        setattr(item, key, value)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise AppError("Period name already exists", 409) from exc
    db.refresh(item)
    return item


def delete_period(db: Session, item_id: int) -> None:
    """Delete a period only if no enrollment depends on it."""
    db.delete(get_period(db, item_id))
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise AppError("Period is in use", 409) from exc


def create_enrollment(
    db: Session, data: EnrollmentCreate, actor_id: int | None = None
) -> Enrollment:
    """Create enrollment; students can only enroll themselves."""
    if actor_id is not None and actor_id != data.student_id:
        raise AppError("Cannot enroll another student", 403)
    student = db.get(User, data.student_id)
    if student is None or not student.is_active:
        raise AppError("Student not found", 404)
    is_student = db.scalar(
        select(Role)
        .join(UserRole, UserRole.role_id == Role.id)
        .where(
            UserRole.user_id == data.student_id,
            Role.name == "student",
            Role.is_active.is_(True),
        )
    )
    if is_student is None:
        raise AppError("User is not a student", 422)
    subject = db.scalar(
        select(Subject).where(
            Subject.id == data.subject_id, Subject.is_active.is_(True)
        )
    )
    if subject is None:
        raise AppError("Subject not found", 404)
    get_period(db, data.period_id)
    enrolled_credits = (
        db.scalar(
            select(func.coalesce(func.sum(Subject.credits), 0))
            .join(Enrollment, Enrollment.subject_id == Subject.id)
            .where(
                Enrollment.student_id == data.student_id,
                Enrollment.period_id == data.period_id,
                Enrollment.status != EnrollmentStatus.CANCELLED,
            )
        )
        or 0
    )
    if enrolled_credits + subject.credits > settings.max_credits_per_period:
        raise AppError(
            f"Credit limit exceeded for period ({settings.max_credits_per_period})", 422
        )
    item = Enrollment(**data.model_dump())
    db.add(item)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise AppError(
            "Enrollment already exists or references invalid data", 409
        ) from exc
    db.refresh(item)
    return item


def get_enrollment(db: Session, item_id: int) -> Enrollment:
    """Fetch enrollment."""
    item = db.get(Enrollment, item_id)
    if item is None:
        raise AppError("Enrollment not found", 404)
    return item


def update_enrollment(
    db: Session,
    item_id: int,
    data: EnrollmentUpdate,
    actor_id: int,
    admin: bool,
    teacher_id: int | None = None,
) -> Enrollment:
    """Update an enrollment lifecycle state within the caller's scope."""
    item = get_enrollment(db, item_id)
    teaches_subject = teacher_id is not None and item.subject.teacher_id == teacher_id
    if not admin and not teaches_subject:
        raise AppError("Insufficient permissions", 403)
    item.status = data.status
    db.commit()
    db.refresh(item)
    return item


def list_enrollments(
    db: Session,
    actor_id: int,
    admin: bool,
    teacher_id: int | None = None,
) -> list[Enrollment]:
    """Return enrollments scoped to a student, teacher, or administrator."""
    query = select(Enrollment).order_by(Enrollment.id)
    if not admin:
        if teacher_id is not None:
            query = query.join(Subject).where(Subject.teacher_id == teacher_id)
        else:
            query = query.where(Enrollment.student_id == actor_id)
    return list(db.scalars(query).all())


def delete_enrollment(
    db: Session,
    item_id: int,
    actor_id: int,
    admin: bool,
    teacher_id: int | None = None,
) -> None:
    """Cancel an enrollment only for its owner or an administrator."""
    item = get_enrollment(db, item_id)
    owns_enrollment = item.student_id == actor_id
    teaches_subject = teacher_id is not None and item.subject.teacher_id == teacher_id
    if not owns_enrollment and not teaches_subject and not admin:
        raise AppError("Insufficient permissions", 403)
    item.status = "cancelled"
    db.commit()
