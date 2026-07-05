"""milestone_a: roles, assignments, tickets, agent_actions

Revision ID: 0002
Revises: 0001
Create Date: 2026-07-04
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Migrate organization_members.role to manager/employee
    op.drop_constraint("org_member_role_check", "organization_members", type_="check")
    op.execute("UPDATE organization_members SET role = 'manager' WHERE role IN ('owner','admin')")
    op.execute("UPDATE organization_members SET role = 'employee' WHERE role = 'member'")
    op.create_check_constraint(
        "org_member_role_check",
        "organization_members",
        "role IN ('manager','employee')",
    )

    # 2. project_assignments
    op.create_table(
        "project_assignments",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("project_id", sa.UUID(), nullable=False),
        sa.Column("employee_id", sa.UUID(), nullable=False),
        sa.Column("assigned_by", sa.UUID(), nullable=False),
        sa.Column("assigned_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["employee_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["assigned_by"], ["users.id"]),
        sa.UniqueConstraint("project_id", "employee_id", name="uq_project_assignment"),
    )
    op.create_index("ix_project_assignments_project_id", "project_assignments", ["project_id"])
    op.create_index("ix_project_assignments_employee_id", "project_assignments", ["employee_id"])

    # 3. tickets (replaces tasks — keep tasks table intact for backward compat)
    op.create_table(
        "tickets",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("project_id", sa.UUID(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("category", sa.String(30), nullable=True),
        sa.Column("assigned_to", sa.UUID(), nullable=True),
        sa.Column("assigned_by", sa.UUID(), nullable=True),
        sa.Column("progress", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("source", sa.String(20), nullable=False, server_default="manual"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["assigned_to"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["assigned_by"], ["users.id"], ondelete="SET NULL"),
        sa.CheckConstraint(
            "category IN ('backend','frontend','database','testing','deployment')",
            name="ticket_category_check",
        ),
        sa.CheckConstraint("progress BETWEEN 0 AND 100", name="ticket_progress_check"),
        sa.CheckConstraint("source IN ('ai_generated','manual')", name="ticket_source_check"),
    )
    op.create_index("ix_tickets_project_id", "tickets", ["project_id"])
    op.create_index("ix_tickets_assigned_to", "tickets", ["assigned_to"])

    # 4. agent_actions
    op.create_table(
        "agent_actions",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("ticket_id", sa.UUID(), nullable=True),
        sa.Column("project_id", sa.UUID(), nullable=False),
        sa.Column("employee_id", sa.UUID(), nullable=False),
        sa.Column("prompt", sa.Text(), nullable=False),
        sa.Column("file_path", sa.Text(), nullable=True),
        sa.Column("diff_summary", sa.Text(), nullable=True),
        sa.Column("cognee_event_id", sa.Text(), nullable=True),
        sa.Column("progress_before", sa.Integer(), nullable=True),
        sa.Column("progress_after", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["ticket_id"], ["tickets.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["employee_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_agent_actions_ticket_id", "agent_actions", ["ticket_id"])
    op.create_index("ix_agent_actions_project_id", "agent_actions", ["project_id"])
    op.create_index("ix_agent_actions_employee_id", "agent_actions", ["employee_id"])

    # 5. Add working_copy_path to projects (for editor file serving)
    op.add_column("projects", sa.Column("working_copy_path", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("projects", "working_copy_path")
    op.drop_table("agent_actions")
    op.drop_table("tickets")
    op.drop_table("project_assignments")
    op.drop_constraint("org_member_role_check", "organization_members", type_="check")
    op.execute("UPDATE organization_members SET role = 'owner' WHERE role = 'manager'")
    op.execute("UPDATE organization_members SET role = 'member' WHERE role = 'employee'")
    op.create_check_constraint(
        "org_member_role_check",
        "organization_members",
        "role IN ('owner','admin','member')",
    )
