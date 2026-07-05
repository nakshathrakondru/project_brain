"""agent_actions: add written_to_memory flag

Revision ID: 0003
Revises: 0002
Create Date: 2026-07-05
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "agent_actions",
        sa.Column("written_to_memory", sa.Boolean(), nullable=False, server_default="false"),
    )


def downgrade() -> None:
    op.drop_column("agent_actions", "written_to_memory")
