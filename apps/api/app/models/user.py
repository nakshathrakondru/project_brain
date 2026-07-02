import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.db import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, default=uuid.uuid4
    )
    auth_provider_id: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str | None] = mapped_column(Text, nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    org_memberships: Mapped[list["OrganizationMember"]] = relationship(  # noqa: F821
        back_populates="user"
    )
    project_memberships: Mapped[list["ProjectMember"]] = relationship(  # noqa: F821
        back_populates="user"
    )
    conversations: Mapped[list["AIConversation"]] = relationship(  # noqa: F821
        back_populates="user"
    )
