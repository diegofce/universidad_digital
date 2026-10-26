"""Create the user_profiles table when it is not already present."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "profile_001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if inspector.has_table("user_profiles"):
        return
    op.create_table(
        "user_profiles",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("first_name", sa.String(length=80), nullable=False),
        sa.Column("last_name", sa.String(length=120), nullable=False),
        sa.Column("identification_number", sa.String(length=40), nullable=False),
        sa.Column("birth_date", sa.Date(), nullable=False),
        sa.Column("phone", sa.String(length=25), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id"),
        sa.UniqueConstraint("identification_number"),
    )
    op.create_index(
        "ix_user_profiles_identification_number",
        "user_profiles",
        ["identification_number"],
        unique=False,
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("user_profiles"):
        return
    op.drop_index("ix_user_profiles_identification_number", table_name="user_profiles")
    op.drop_table("user_profiles")
