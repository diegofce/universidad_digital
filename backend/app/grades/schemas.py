"""Grade API schemas."""

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class GradeCreate(BaseModel):
    """Create an assessment grade."""

    enrollment_id: int = Field(gt=0)
    score: Decimal = Field(ge=0, le=5, max_digits=4, decimal_places=2)
    assessment: str = Field(min_length=1, max_length=120)


class GradeUpdate(BaseModel):
    """Update grade score or assessment label."""

    score: Decimal | None = Field(
        default=None, ge=0, le=5, max_digits=4, decimal_places=2
    )
    assessment: str | None = Field(default=None, min_length=1, max_length=120)


class GradeResponse(BaseModel):
    """Public grade representation."""

    model_config = ConfigDict(from_attributes=True)
    id: int
    enrollment_id: int
    score: Decimal
    assessment: str
    created_at: datetime


class GradeSummaryResponse(BaseModel):
    """Weighted academic average for one student."""

    student_id: int
    period_id: int | None
    weighted_average: Decimal | None
