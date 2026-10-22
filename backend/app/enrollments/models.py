"""Academic periods and enrollment persistence models."""

from datetime import date, datetime
from enum import Enum

from app.core.database import Base
from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy import Enum as SqlEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates


class AcademicPeriod(Base):
    """Enrollment period with bounded dates."""

    __tablename__ = "academic_periods"
    __table_args__ = (CheckConstraint("ends_on > starts_on", name="ck_period_dates"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    starts_on: Mapped[date] = mapped_column(Date, nullable=False)
    ends_on: Mapped[date] = mapped_column(Date, nullable=False)
    enrollments: Mapped[list["Enrollment"]] = relationship(back_populates="period")

    @validates("starts_on", "ends_on")
    def validate_dates(self, key: str, value: date) -> date:
        """Reject periods whose end date does not follow the start date."""
        starts_on = value if key == "starts_on" else getattr(self, "starts_on", None)
        ends_on = value if key == "ends_on" else getattr(self, "ends_on", None)
        if starts_on is not None and ends_on is not None and ends_on <= starts_on:
            raise ValueError("ends_on must be greater than starts_on")
        return value


class EnrollmentStatus(str, Enum):
    """Lifecycle states available for an enrollment."""

    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class Enrollment(Base):
    """Student registration in a subject during an academic period."""

    __tablename__ = "enrollments"
    __table_args__ = (
        UniqueConstraint(
            "student_id",
            "subject_id",
            "period_id",
            name="uq_enrollment_student_subject_period",
        ),
    )
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    student_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    subject_id: Mapped[int] = mapped_column(
        ForeignKey("subjects.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    period_id: Mapped[int] = mapped_column(
        ForeignKey("academic_periods.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    status: Mapped[EnrollmentStatus] = mapped_column(
        SqlEnum(EnrollmentStatus, name="enrollment_status"),
        nullable=False,
        default=EnrollmentStatus.ACTIVE,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    student: Mapped["User"] = relationship()
    subject: Mapped["Subject"] = relationship(back_populates="enrollments")
    period: Mapped[AcademicPeriod] = relationship(back_populates="enrollments")
    grades: Mapped[list["Grade"]] = relationship(
        back_populates="enrollment", cascade="all, delete-orphan"
    )
