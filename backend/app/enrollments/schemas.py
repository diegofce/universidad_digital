"""Academic period and enrollment API schemas."""

from datetime import date, datetime

from app.enrollments.models import EnrollmentStatus
from pydantic import BaseModel, ConfigDict, Field, model_validator


class PeriodCreate(BaseModel):
    """Create an academic period."""

    name: str = Field(min_length=1, max_length=80)
    starts_on: date
    ends_on: date

    @model_validator(mode="after")
    def valid_dates(self):
        if self.ends_on <= self.starts_on:
            raise ValueError("ends_on must follow starts_on")
        return self


class PeriodUpdate(BaseModel):
    """Update academic period fields."""

    name: str | None = Field(default=None, min_length=1, max_length=80)
    starts_on: date | None = None
    ends_on: date | None = None


class PeriodResponse(BaseModel):
    """Academic period representation."""

    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    starts_on: date
    ends_on: date


class EnrollmentCreate(BaseModel):
    """Enroll a student in a subject and period."""

    student_id: int = Field(gt=0)
    subject_id: int = Field(gt=0)
    period_id: int = Field(gt=0)


class EnrollmentUpdate(BaseModel):
    """Update the lifecycle state of an enrollment."""

    status: EnrollmentStatus


class EnrollmentResponse(BaseModel):
    """Enrollment representation."""

    model_config = ConfigDict(from_attributes=True)
    id: int
    student_id: int
    subject_id: int
    period_id: int
    status: EnrollmentStatus
    created_at: datetime
