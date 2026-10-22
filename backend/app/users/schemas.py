"""Validated user request and response schemas."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class UserCreate(BaseModel):
    """Fields accepted when creating a user."""

    email: EmailStr
    full_name: str = Field(min_length=1, max_length=160)
    password: str = Field(min_length=12, max_length=128)
    roles: list[str] = Field(default_factory=list)


class UserUpdate(BaseModel):
    """Optional fields accepted when updating a user."""

    email: EmailStr | None = None
    full_name: str | None = Field(default=None, min_length=1, max_length=160)
    password: str | None = Field(default=None, min_length=12, max_length=128)
    is_active: bool | None = None
    roles: list[str] | None = None


class UserResponse(BaseModel):
    """Public user representation without credential data."""

    model_config = ConfigDict(from_attributes=True)
    id: int
    email: EmailStr
    full_name: str
    is_active: bool
    created_at: datetime
    roles: list[str] = Field(default_factory=list)

    @field_validator("roles", mode="before")
    @classmethod
    def serialize_roles(cls, value: object) -> list[str]:
        """Serialize ORM role associations as public role names."""
        if value is None:
            return []
        return [getattr(role, "role_name", role) for role in value]


class LoginRequest(BaseModel):
    """Credentials submitted to the login endpoint."""

    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class RoleCreate(BaseModel):
    """Create a database-managed role."""

    name: str = Field(min_length=1, max_length=64, pattern=r"^[a-z][a-z0-9_.:-]*$")
    description: str = Field(min_length=1, max_length=255)


class RoleUpdate(BaseModel):
    """Update a role without changing application code."""

    name: str | None = Field(
        default=None, min_length=1, max_length=64, pattern=r"^[a-z][a-z0-9_.:-]*$"
    )
    description: str | None = Field(default=None, min_length=1, max_length=255)
    is_active: bool | None = None


class RoleResponse(BaseModel):
    """Public role representation."""

    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    description: str
    is_active: bool


class PermissionCreate(BaseModel):
    """Create a database-managed permission."""

    name: str = Field(min_length=1, max_length=100, pattern=r"^[a-z][a-z0-9_.:-]*$")
    description: str = Field(min_length=1, max_length=255)


class PermissionUpdate(BaseModel):
    """Update a permission definition."""

    name: str | None = Field(
        default=None, min_length=1, max_length=100, pattern=r"^[a-z][a-z0-9_.:-]*$"
    )
    description: str | None = Field(default=None, min_length=1, max_length=255)
    is_active: bool | None = None


class PermissionResponse(BaseModel):
    """Public permission representation."""

    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    description: str
    is_active: bool


class RolePermissionUpdate(BaseModel):
    """Replace a role's permission set by permission names."""

    permissions: list[str] = Field(default_factory=list)
