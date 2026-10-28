"""Persistence and business-rule integration tests using temporary SQLite."""

from decimal import Decimal

import pytest
from app.core.errors import AppError
from app.enrollments.schemas import EnrollmentCreate, PeriodCreate
from app.enrollments.services import create_enrollment, create_period
from app.grades.schemas import GradeCreate
from app.grades.services import calculate_weighted_average, create_grade
from app.subjects.services import create_subject
from tests.factories.academic import create_enrollment as enrollment_factory
from tests.factories.academic import create_subject as subject_factory


@pytest.mark.integration
def test_enrollment_persists_and_prevents_another_student(
    db_session, valid_user, seeded_roles
):
    period = create_period(
        db_session,
        PeriodCreate(name="2026-1", starts_on="2026-01-01", ends_on="2026-06-30"),
    )
    subject = subject_factory(db_session)

    enrollment = create_enrollment(
        db_session,
        EnrollmentCreate(
            student_id=valid_user.id, subject_id=subject.id, period_id=period.id
        ),
        actor_id=valid_user.id,
    )

    assert enrollment.id is not None
    with pytest.raises(AppError, match="another student"):
        create_enrollment(
            db_session,
            EnrollmentCreate(
                student_id=valid_user.id, subject_id=subject.id, period_id=period.id
            ),
            actor_id=valid_user.id + 999,
        )


@pytest.mark.integration
def test_weighted_average_uses_subject_credits(db_session, valid_user):
    period = create_period(
        db_session,
        PeriodCreate(name="2026-2", starts_on="2026-07-01", ends_on="2026-12-31"),
    )
    first = subject_factory(db_session, code="MAT-101", credits=1)
    second = subject_factory(db_session, code="MAT-102", credits=3)
    first_enrollment = enrollment_factory(
        db_session, valid_user.id, first.id, period.id
    )
    second_enrollment = enrollment_factory(
        db_session, valid_user.id, second.id, period.id
    )
    create_grade(
        db_session,
        GradeCreate(
            enrollment_id=first_enrollment.id, score=Decimal("5.00"), assessment="Quiz"
        ),
        admin=True,
    )
    create_grade(
        db_session,
        GradeCreate(
            enrollment_id=second_enrollment.id, score=Decimal("3.00"), assessment="Exam"
        ),
        admin=True,
    )

    average = calculate_weighted_average(db_session, valid_user.id, period.id)

    assert average == Decimal("3.50")


@pytest.mark.integration
def test_subject_service_rejects_unknown_teacher(db_session):
    from app.subjects.schemas import SubjectCreate

    with pytest.raises(AppError, match="Teacher not found"):
        create_subject(
            db_session,
            SubjectCreate(code="PHY-101", name="Physics", credits=3, teacher_id=999),
        )
