"""Grade persistence model."""
from datetime import datetime
from decimal import Decimal
from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

class Grade(Base):
    """A numeric assessment attached to one enrollment."""
    __tablename__ = "grades"
    __table_args__ = (CheckConstraint("score >= 0 AND score <= 5", name="ck_grade_score_range"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    enrollment_id: Mapped[int] = mapped_column(ForeignKey("enrollments.id", ondelete="RESTRICT"), nullable=False, index=True)
    score: Mapped[Decimal] = mapped_column(Numeric(4, 2), nullable=False)
    assessment: Mapped[str] = mapped_column(String(120), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    enrollment: Mapped["Enrollment"] = relationship(back_populates="grades")
