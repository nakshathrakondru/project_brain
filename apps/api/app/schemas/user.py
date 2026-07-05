import uuid
from datetime import datetime
from pydantic import BaseModel, field_validator


class UserBase(BaseModel):
    email: str
    name: str | None = None
    avatar_url: str | None = None


class UserCreate(UserBase):
    auth_provider_id: str


class UserRead(UserBase):
    id: uuid.UUID
    auth_provider_id: str
    created_at: datetime

    model_config = {"from_attributes": True}


class UserUpsert(BaseModel):
    """Used by the JWT middleware to upsert a user on first login."""
    auth_provider_id: str
    email: str  # plain str — Clerk fallback emails like user@clerk.local are valid here
    name: str | None = None
    avatar_url: str | None = None

    @field_validator("email")
    @classmethod
    def clean_email(cls, v: str) -> str:
        # Strip whitespace, lowercase
        return v.strip().lower() if v else v
