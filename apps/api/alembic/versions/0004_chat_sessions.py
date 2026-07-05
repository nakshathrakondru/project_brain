"""chat_sessions and agent_sessions for persistent history

Revision ID: 0004
Revises: 0003
Create Date: 2026-07-05
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Chat sessions for AI Tech Lead
    op.create_table(
        "chat_sessions",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("project_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False, server_default="New chat"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_chat_sessions_project_user", "chat_sessions", ["project_id", "user_id"])

    # Add session_id to ai_conversations
    op.add_column("ai_conversations",
        sa.Column("session_id", sa.UUID(), nullable=True))
    op.create_foreign_key(
        "fk_conversations_session",
        "ai_conversations", "chat_sessions",
        ["session_id"], ["id"], ondelete="SET NULL"
    )

    # Agent sessions for code editor
    op.create_table(
        "agent_sessions",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("project_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False, server_default="New session"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_agent_sessions_project_user", "agent_sessions", ["project_id", "user_id"])

    # Add agent_session_id to agent_actions
    op.add_column("agent_actions",
        sa.Column("agent_session_id", sa.UUID(), nullable=True))
    op.create_foreign_key(
        "fk_agent_actions_session",
        "agent_actions", "agent_sessions",
        ["agent_session_id"], ["id"], ondelete="SET NULL"
    )

    # Agent session messages (stores the full conversation history)
    op.create_table(
        "agent_messages",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("session_id", sa.UUID(), nullable=False),
        sa.Column("role", sa.String(20), nullable=False),  # user | agent
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("file_path", sa.Text(), nullable=True),
        sa.Column("written_to_memory", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("ticket_progress", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["session_id"], ["agent_sessions.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_agent_messages_session_id", "agent_messages", ["session_id"])


def downgrade() -> None:
    op.drop_table("agent_messages")
    op.drop_constraint("fk_agent_actions_session", "agent_actions", type_="foreignkey")
    op.drop_column("agent_actions", "agent_session_id")
    op.drop_table("agent_sessions")
    op.drop_constraint("fk_conversations_session", "ai_conversations", type_="foreignkey")
    op.drop_column("ai_conversations", "session_id")
    op.drop_table("chat_sessions")
