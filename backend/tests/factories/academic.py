"""Small factories for academic-domain entities."""

from datetime import date

from app.enrollments.models import AcademicPeriod, Enrollment
from app.enrollments.schemas import EnrollmentCreate
from app.subjects.models import Subject
from sqlalchemy.orm import Session


def create_period(db: Session, name: str = "2026-1") -> AcademicPeriod:
    item = AcademicPeriod(
        name=name, starts_on=date(2026, 1, 1), ends_on=date(2026, 6, 30)
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def create_subject(
    db: Session,
    *,
    code: str = "MAT-101",
    credits: int = 3,
    teacher_id: int | None = None,
) -> Subject:
    item = Subject(
        code=code, name="Mathematics", credits=credits, teacher_id=teacher_id
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def create_enrollment(
    db: Session, student_id: int, subject_id: int, period_id: int
) -> Enrollment:
    item = Enrollment(
        **EnrollmentCreate(
            student_id=student_id, subject_id=subject_id, period_id=period_id
        ).model_dump()
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item
