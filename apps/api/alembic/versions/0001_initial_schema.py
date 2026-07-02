"""initial schema

Revision ID: 0001
Revises:
Create Date: 2024-01-01 00:00:00.000000

"""
from typing import Sequence, Union
import uuid
import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # users
    op.create_table(
        "users",
        sa.Column("id", sa.UUID(), nullable=False, default=uuid.uuid4),
        sa.Column("auth_provider_id", sa.String(255), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("name", sa.Text(), nullable=True),
        sa.Column("avatar_url", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("auth_provider_id"),
        sa.UniqueConstraint("email"),
    )
    op.create_index("ix_users_auth_provider_id", "users", ["auth_provider_id"])
    op.create_index("ix_users_email", "users", ["email"])

    # organizations
    op.create_table(
        "organizations",
        sa.Column("id", sa.UUID(), nullable=False, default=uuid.uuid4),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("slug", sa.String(100), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )
    op.create_index("ix_organizations_slug", "organizations", ["slug"])

    # organization_members
    op.create_table(
        "organization_members",
        sa.Column("id", sa.UUID(), nullable=False, default=uuid.uuid4),
        sa.Column("organization_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("role", sa.String(20), nullable=False, server_default="member"),
        sa.Column("invited_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("joined_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.CheckConstraint("role IN ('owner','admin','member')", name="org_member_role_check"),
    )
    op.create_index("ix_org_members_org_id", "organization_members", ["organization_id"])
    op.create_index("ix_org_members_user_id", "organization_members", ["user_id"])

    # projects
    op.create_table(
        "projects",
        sa.Column("id", sa.UUID(), nullable=False, default=uuid.uuid4),
        sa.Column("organization_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("repo_url", sa.Text(), nullable=True),
        sa.Column("repo_default_branch", sa.String(100), nullable=True, server_default="main"),
        sa.Column("cognee_dataset_id", sa.String(255), nullable=True),
        sa.Column("ingestion_status", sa.String(20), nullable=False, server_default="not_started"),
        sa.Column("created_by", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.CheckConstraint(
            "ingestion_status IN ('not_started','queued','in_progress','completed','failed')",
            name="project_ingestion_status_check",
        ),
    )
    op.create_index("ix_projects_org_id", "projects", ["organization_id"])

    # project_members
    op.create_table(
        "project_members",
        sa.Column("id", sa.UUID(), nullable=False, default=uuid.uuid4),
        sa.Column("project_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("role", sa.String(20), nullable=False, server_default="contributor"),
        sa.Column("added_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.CheckConstraint("role IN ('lead','contributor','viewer')", name="project_member_role_check"),
    )
    op.create_index("ix_project_members_project_id", "project_members", ["project_id"])
    op.create_index("ix_project_members_user_id", "project_members", ["user_id"])

    # ingestion_jobs
    op.create_table(
        "ingestion_jobs",
        sa.Column("id", sa.UUID(), nullable=False, default=uuid.uuid4),
        sa.Column("project_id", sa.UUID(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="queued"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("files_processed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_ingestion_jobs_project_id", "ingestion_jobs", ["project_id"])

    # tasks
    op.create_table(
        "tasks",
        sa.Column("id", sa.UUID(), nullable=False, default=uuid.uuid4),
        sa.Column("project_id", sa.UUID(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("category", sa.String(30), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="todo"),
        sa.Column("source", sa.String(20), nullable=False, server_default="manual"),
        sa.Column("memory_node_id", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.CheckConstraint(
            "category IN ('backend','frontend','database','testing','deployment')",
            name="task_category_check",
        ),
        sa.CheckConstraint("status IN ('todo','in_progress','done')", name="task_status_check"),
        sa.CheckConstraint("source IN ('ai_generated','manual')", name="task_source_check"),
    )
    op.create_index("ix_tasks_project_id", "tasks", ["project_id"])

    # ai_conversations
    op.create_table(
        "ai_conversations",
        sa.Column("id", sa.UUID(), nullable=False, default=uuid.uuid4),
        sa.Column("project_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("question", sa.Text(), nullable=False),
        sa.Column("answer", sa.Text(), nullable=False),
        sa.Column("memory_node_id", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_conversations_project_id", "ai_conversations", ["project_id"])


def downgrade() -> None:
    op.drop_table("ai_conversations")
    op.drop_table("tasks")
    op.drop_table("ingestion_jobs")
    op.drop_table("project_members")
    op.drop_table("projects")
    op.drop_table("organization_members")
    op.drop_table("organizations")
    op.drop_table("users")
