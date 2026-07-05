"""
Seed demo data:
- Default org
- 3 users: manager, employee1, employee2
  All mapped to Clerk userids by username convention
  (actual Clerk auth_provider_ids will be set on first login via /auth/me)
"""
import asyncio, uuid, os, sys
sys.path.insert(0, "/app")
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

DATABASE_URL = os.environ["DATABASE_URL"]
engine = create_async_engine(DATABASE_URL)
Session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

ORG_ID = "8c83bef5-0a1a-4e76-a7a1-02735068efa7"
ORG_NAME = "Demo Org"
ORG_SLUG = "demo-org"

# These will be updated when each user first signs in via Clerk
# placeholder auth_provider_ids — will be replaced on first /auth/me call
USERS = [
    {"id": "11111111-0000-0000-0000-000000000001", "auth_provider_id": "pending_manager",
     "email": "manager@mycelium.demo", "name": "Manager", "role": "manager"},
    {"id": "11111111-0000-0000-0000-000000000002", "auth_provider_id": "pending_employee1",
     "email": "employee1@mycelium.demo", "name": "Employee 1", "role": "employee"},
    {"id": "11111111-0000-0000-0000-000000000003", "auth_provider_id": "pending_employee2",
     "email": "employee2@mycelium.demo", "name": "Employee 2", "role": "employee"},
]

async def seed():
    async with Session() as db:
        now = datetime.now(timezone.utc)

        # Create org
        await db.execute(text(
            "INSERT INTO organizations (id, name, slug, created_at) VALUES (:id::uuid, :name, :slug, :now) "
            "ON CONFLICT DO NOTHING"
        ).bindparams(id=ORG_ID, name=ORG_NAME, slug=ORG_SLUG, now=now))

        for u in USERS:
            # Create user
            await db.execute(text(
                "INSERT INTO users (id, auth_provider_id, email, name, created_at) "
                "VALUES (:id::uuid, :auth, :email, :name, :now) ON CONFLICT DO NOTHING"
            ).bindparams(id=u["id"], auth=u["auth_provider_id"], email=u["email"], name=u["name"], now=now))

            # Add org membership
            mid = str(uuid.uuid4())
            await db.execute(text(
                "INSERT INTO organization_members (id, organization_id, user_id, role, joined_at) "
                "VALUES (:id::uuid, :org::uuid, :uid::uuid, :role, :now) ON CONFLICT DO NOTHING"
            ).bindparams(id=mid, org=ORG_ID, uid=u["id"], role=u["role"], now=now))

            print(f"Seeded {u['role']}: {u['name']} ({u['email']})")

        await db.commit()
        print(f"\nOrg ID (for NEXT_PUBLIC_DEFAULT_ORG_ID): {ORG_ID}")
        print("Done. Users will get their real Clerk IDs on first login.")

if __name__ == "__main__":
    asyncio.run(seed())
