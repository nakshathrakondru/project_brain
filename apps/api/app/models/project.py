import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, DateTime, ForeignKey, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.db import Base


class Project(Base):
    __tablename__ = "projects"

    __table_args__ = (
        CheckConstraint(
            "ingestion_status IN ('not_started','queued','in_progress','completed','failed')",
            name="project_ingestion_status_check",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    repo_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    repo_default_branch: Mapped[str | None] = mapped_column(String(100), nullable=True, default="main")
    # Pointer to this project's isolated Cognee memory namespace
    cognee_dataset_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    ingestion_status: Mapped[str] = mapped_column(String(20), default="not_started")
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    organization: Mapped["Organization"] = relationship(back_populates="projects")  # noqa: F821
    members: Mapped[list["ProjectMember"]] = relationship(back_populates="project")
    ingestion_jobs: Mapped[list["IngestionJob"]] = relationship(back_populates="project")  # noqa: F821
    tasks: Mapped[list["Task"]] = relationship(back_populates="project")  # noqa: F821
    conversations: Mapped[list["AIConversation"]] = relationship(back_populates="project")  # noqa: F821


class ProjectMember(Base):
    __tablename__ = "project_members"

    __table_args__ = (
        CheckConstraint("role IN ('lead','contributor','viewer')", name="project_member_role_check"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[str] = mapped_column(String(20), default="contributor")
    added_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    project: Mapped["Project"] = relationship(back_populates="members")
    user: Mapped["User"] = relationship(back_populates="project_memberships")  # noqa: F821
