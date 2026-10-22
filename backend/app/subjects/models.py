"""Subject persistence model."""

from app.core.database import Base
from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates


class Subject(Base):
    """Academic subject catalog entry."""

    __tablename__ = "subjects"
    __table_args__ = (
        CheckConstraint("credits BETWEEN 1 AND 30", name="ck_subject_credits_range"),
    )
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(
        String(24), unique=True, index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str | None] = mapped_column(String(1000))
    credits: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    teacher_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    enrollments: Mapped[list["Enrollment"]] = relationship(back_populates="subject")
    teacher: Mapped["User | None"] = relationship(foreign_keys=[teacher_id])

    @validates("code")
    def normalize_code(self, key: str, value: str) -> str:
        """Normalize subject codes for stable uniqueness checks."""
        return value.strip().upper()
