import uuid
from datetime import datetime
from pydantic import BaseModel, EmailStr


class UserBase(BaseModel):
    email: EmailStr
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
    email: EmailStr
    name: str | None = None
    avatar_url: str | None = None
