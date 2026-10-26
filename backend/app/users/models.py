"""User and role persistence models."""

from datetime import date, datetime

from app.core.database import Base
from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates


class User(Base):
    """University account; password hashes are never exposed by response schemas."""

    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(
        String(320), unique=True, index=True, nullable=False
    )
    full_name: Mapped[str] = mapped_column(String(160), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    roles: Mapped[list["UserRole"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    profile: Mapped["UserProfile | None"] = relationship(
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )

    @validates("email")
    def normalize_email(self, key: str, value: str) -> str:
        """Normalize email addresses before persistence."""
        return value.strip().lower()

    @property
    def permissions(self) -> list[str]:
        """Return active permissions granted through active roles."""
        return sorted(
            {
                role_permission.permission.name
                for user_role in self.roles
                if user_role.role.is_active
                for role_permission in user_role.role.permissions
                if role_permission.permission.is_active
            }
        )

    @property
    def first_name(self) -> str | None:
        """Expose profile first name for API serialization."""
        return self.profile.first_name if self.profile else None

    @property
    def last_name(self) -> str | None:
        """Expose profile last name for API serialization."""
        return self.profile.last_name if self.profile else None

    @property
    def identification_number(self) -> str | None:
        """Expose profile identification number for API serialization."""
        return self.profile.identification_number if self.profile else None

    @property
    def birth_date(self) -> date | None:
        """Expose profile birth date for API serialization."""
        return self.profile.birth_date if self.profile else None

    @property
    def phone(self) -> str | None:
        """Expose profile phone for API serialization."""
        return self.profile.phone if self.profile else None


class UserProfile(Base):
    """Personal and academic identity data separated from credentials."""

    __tablename__ = "user_profiles"
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    first_name: Mapped[str] = mapped_column(String(80), nullable=False)
    last_name: Mapped[str] = mapped_column(String(120), nullable=False)
    identification_number: Mapped[str] = mapped_column(
        String(40), unique=True, index=True, nullable=False
    )
    birth_date: Mapped[date] = mapped_column(Date, nullable=False)
    phone: Mapped[str] = mapped_column(String(25), nullable=False)
    user: Mapped[User] = relationship(back_populates="profile")


class UserRole(Base):
    """User-to-role association using database role identifiers."""

    __tablename__ = "user_roles"
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    role_id: Mapped[int] = mapped_column(
        ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True
    )
    user: Mapped[User] = relationship(back_populates="roles")
    role: Mapped["Role"] = relationship(back_populates="users")

    @property
    def role_name(self) -> str:
        """Expose the role name for response and authorization compatibility."""
        return self.role.name


class Role(Base):
    """Database-managed role definition."""

    __tablename__ = "roles"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    users: Mapped[list[UserRole]] = relationship(
        back_populates="role", cascade="all, delete-orphan"
    )
    permissions: Mapped[list["RolePermission"]] = relationship(
        back_populates="role", cascade="all, delete-orphan"
    )


class Permission(Base):
    """Database-managed permission definition."""

    __tablename__ = "permissions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    roles: Mapped[list["RolePermission"]] = relationship(
        back_populates="permission", cascade="all, delete-orphan"
    )


class RolePermission(Base):
    """Role-to-permission association."""

    __tablename__ = "role_permissions"
    role_id: Mapped[int] = mapped_column(
        ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True
    )
    permission_id: Mapped[int] = mapped_column(
        ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True
    )
    role: Mapped[Role] = relationship(back_populates="permissions")
    permission: Mapped[Permission] = relationship(back_populates="roles")


class RoleAudit(Base):
    """Immutable audit record for role and permission administration."""

    __tablename__ = "role_audits"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    actor_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    role_id: Mapped[int | None] = mapped_column(
        ForeignKey("roles.id", ondelete="SET NULL"), nullable=True, index=True
    )
    action: Mapped[str] = mapped_column(String(80), nullable=False)
    details: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
