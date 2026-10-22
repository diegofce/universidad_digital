"""Subject API schemas."""

from pydantic import BaseModel, ConfigDict, Field


class SubjectCreate(BaseModel):
    """Create a subject."""

    code: str = Field(min_length=1, max_length=24, pattern=r"^[A-Za-z0-9_-]+$")
    name: str = Field(min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=1000)
    credits: int = Field(ge=1, le=30)
    teacher_id: int | None = Field(default=None, gt=0)


class SubjectUpdate(BaseModel):
    """Update subject fields."""

    code: str | None = Field(
        default=None, min_length=1, max_length=24, pattern=r"^[A-Za-z0-9_-]+$"
    )
    name: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=1000)
    credits: int | None = Field(default=None, ge=1, le=30)
    teacher_id: int | None = Field(default=None, gt=0)


class SubjectResponse(BaseModel):
    """Public subject representation."""

    model_config = ConfigDict(from_attributes=True)
    id: int
    code: str
    name: str
    description: str | None
    credits: int
    is_active: bool
    teacher_id: int | None
