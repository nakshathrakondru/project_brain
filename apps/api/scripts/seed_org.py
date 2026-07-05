"""
Dev seed script — creates a default organization if one doesn't exist,
and prints its UUID. Run via:
  docker compose exec api python scripts/seed_org.py
"""
import asyncio
import uuid
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
import os
import sys

# Add the app directory to path
sys.path.insert(0, "/app")

from app.models.organization import Organization

DATABASE_URL = os.environ["DATABASE_URL"]

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

DEFAULT_ORG_NAME = "Default Org"
DEFAULT_ORG_SLUG = "default-org"


async def seed():
    async with AsyncSessionLocal() as db:
        # Check if org already exists
        result = await db.execute(
            select(Organization).where(Organization.slug == DEFAULT_ORG_SLUG)
        )
        org = result.scalar_one_or_none()

        if org:
            print(f"✓ Org already exists: {org.id}")
        else:
            org = Organization(
                id=uuid.uuid4(),
                name=DEFAULT_ORG_NAME,
                slug=DEFAULT_ORG_SLUG,
            )
            db.add(org)
            await db.commit()
            await db.refresh(org)
            print(f"✓ Created org: {org.id}")

        print(f"\nAdd this to infra/.env:\nNEXT_PUBLIC_DEFAULT_ORG_ID={org.id}")
        return str(org.id)


if __name__ == "__main__":
    asyncio.run(seed())
