"""Database engine, session factory, and declarative base."""

from collections.abc import Generator

from app.core.config import settings
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker


class Base(DeclarativeBase):
    """Base class for persistence models."""


engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    """Yield one database session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables() -> None:
    """Create missing tables after the database itself has been provisioned."""
    from app.enrollments.models import AcademicPeriod, Enrollment  # noqa: F401
    from app.grades.models import Grade  # noqa: F401
    from app.subjects.models import Subject  # noqa: F401
    from app.users.models import (  # noqa: F401
        Permission,
        Role,
        RoleAudit,
        RolePermission,
        User,
        UserProfile,
        UserRole,
    )

    Base.metadata.create_all(bind=engine)
