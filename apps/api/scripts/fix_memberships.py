"""Fix: add all existing users as managers in the default org."""
import asyncio
import uuid
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
import os, sys
sys.path.insert(0, "/app")

DATABASE_URL = os.environ["DATABASE_URL"]
engine = create_async_engine(DATABASE_URL)
Session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

DEFAULT_ORG_ID = "8c83bef5-0a1a-4e76-a7a1-02735068efa7"


async def fix():
    async with Session() as db:
        users = await db.execute(text("SELECT id FROM users"))
        user_ids = [str(r[0]) for r in users.fetchall()]

        for uid in user_ids:
            existing = await db.execute(text(
                "SELECT id FROM organization_members WHERE organization_id=:org::uuid AND user_id=:uid::uuid"
            ).bindparams(org=DEFAULT_ORG_ID, uid=uid))
            if not existing.fetchone():
                mid = str(uuid.uuid4())
                now = datetime.now(timezone.utc)
                await db.execute(text(
                    "INSERT INTO organization_members (id, organization_id, user_id, role, joined_at) "
                    "VALUES (:id::uuid, :org::uuid, :uid::uuid, 'manager', :now)"
                ).bindparams(id=mid, org=DEFAULT_ORG_ID, uid=uid, now=now))
                print(f"Added manager: {uid}")
            else:
                await db.execute(text(
                    "UPDATE organization_members SET role='manager' WHERE organization_id=:org::uuid AND user_id=:uid::uuid"
                ).bindparams(org=DEFAULT_ORG_ID, uid=uid))
                print(f"Updated to manager: {uid}")

        await db.commit()
        print("Done")


if __name__ == "__main__":
    asyncio.run(fix())
