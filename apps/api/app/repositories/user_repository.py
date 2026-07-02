import uuid
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.user import User
from app.schemas.user import UserUpsert


class UserRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_auth_provider_id(self, auth_provider_id: str) -> User | None:
        result = await self.db.execute(
            select(User).where(User.auth_provider_id == auth_provider_id)
        )
        return result.scalar_one_or_none()

    async def get_by_id(self, user_id: uuid.UUID) -> User | None:
        result = await self.db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> User | None:
        result = await self.db.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    async def upsert(self, data: UserUpsert) -> User:
        """Create or update a user from Clerk token data."""
        user = await self.get_by_auth_provider_id(data.auth_provider_id)
        if user:
            user.email = data.email
            if data.name:
                user.name = data.name
            if data.avatar_url:
                user.avatar_url = data.avatar_url
        else:
            user = User(
                auth_provider_id=data.auth_provider_id,
                email=data.email,
                name=data.name,
                avatar_url=data.avatar_url,
                created_at=datetime.now(timezone.utc),
            )
            self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user
