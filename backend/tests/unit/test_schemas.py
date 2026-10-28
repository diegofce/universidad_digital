"""Fast, dependency-free tests for API validation contracts."""

from datetime import date, timedelta
from decimal import Decimal

import pytest
from app.enrollments.schemas import PeriodCreate
from app.grades.schemas import GradeCreate
from app.subjects.schemas import SubjectCreate
from app.users.schemas import UserCreate
from pydantic import ValidationError


@pytest.mark.unit
@pytest.mark.parametrize("score", [Decimal("-0.01"), Decimal("5.01"), Decimal(6)])
def test_grade_rejects_score_outside_business_range(score: Decimal) -> None:
    with pytest.raises(ValidationError):
        GradeCreate(enrollment_id=1, score=score, assessment="Midterm")


@pytest.mark.unit
@pytest.mark.parametrize("credits", [0, 31, -1])
def test_subject_rejects_invalid_credit_count(credits: int) -> None:
    with pytest.raises(ValidationError):
        SubjectCreate(code="MAT-101", name="Math", credits=credits)


@pytest.mark.unit
def test_user_rejects_future_birth_date() -> None:
    with pytest.raises(ValidationError, match="future"):
        UserCreate(
            email="student@example.com",
            full_name="Future Student",
            password="valid-password-123",
            first_name="Future",
            last_name="Student",
            identification_number="FUTURE-001",
            birth_date=date.today() + timedelta(days=1),
            phone="+573001112233",
        )


@pytest.mark.unit
def test_period_requires_end_after_start() -> None:
    with pytest.raises(ValidationError, match="ends_on"):
        PeriodCreate(
            name="Invalid", starts_on=date(2026, 6, 1), ends_on=date(2026, 6, 1)
        )
