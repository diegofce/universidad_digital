"""Add indexes declared by the RoleAudit ORM model."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import context, op

revision: str = "role_audit_indexes_002"
down_revision: str | None = "profile_001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    if context.is_offline_mode():
        op.create_index(
            "ix_role_audits_actor_user_id", "role_audits", ["actor_user_id"]
        )
        op.create_index("ix_role_audits_role_id", "role_audits", ["role_id"])
        return
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table("role_audits"):
        return
    existing = {index["name"] for index in inspector.get_indexes("role_audits")}
    if "ix_role_audits_actor_user_id" not in existing:
        op.create_index(
            "ix_role_audits_actor_user_id", "role_audits", ["actor_user_id"]
        )
    if "ix_role_audits_role_id" not in existing:
        op.create_index("ix_role_audits_role_id", "role_audits", ["role_id"])


def downgrade() -> None:
    op.drop_index("ix_role_audits_role_id", table_name="role_audits", if_exists=True)
    op.drop_index(
        "ix_role_audits_actor_user_id", table_name="role_audits", if_exists=True
    )
