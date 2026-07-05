"""
Auth endpoints — thin wrappers around Clerk.
The frontend handles sign-in/sign-up via Clerk SDK directly.
These endpoints handle: user upsert on first login, and returning the current user.
"""
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.db import get_db
from app.core.config import get_settings
from app.core.security import get_current_user_id, verify_clerk_token
from app.repositories.user_repository import UserRepository
from app.models.organization import Organization, OrganizationMember
from app.schemas.user import UserRead, UserUpsert

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


async def _auto_join_default_org(user_id: uuid.UUID, db: AsyncSession) -> None:
    """
    Auto-join the user to the default org as manager if not already a member.
    This ensures every user can see projects immediately after signing up.
    """
    default_org_id = settings.default_org_id
    if not default_org_id:
        return

    try:
        org_uuid = uuid.UUID(default_org_id)
    except ValueError:
        return

    # Check org exists
    org_result = await db.execute(select(Organization).where(Organization.id == org_uuid))
    if not org_result.scalar_one_or_none():
        return

    # Check already a member
    member_result = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.organization_id == org_uuid,
            OrganizationMember.user_id == user_id,
        )
    )
    if member_result.scalar_one_or_none():
        return  # Already a member — role is already set (employee or manager)

    # New user not pre-seeded — default to manager (first signup flow)
    member = OrganizationMember(
        organization_id=org_uuid,
        user_id=user_id,
        role="manager",
        joined_at=datetime.now(timezone.utc),
    )
    db.add(member)
    await db.commit()


@router.post("/me", response_model=UserRead)
async def upsert_current_user(
    payload: dict = Depends(verify_clerk_token),
    db: AsyncSession = Depends(get_db),
):
    """
    Called by the frontend after Clerk login to register/sync the user in our DB.
    Extracts identity from the verified Clerk JWT and upserts the user row.
    Auto-joins the user to the default org as manager on first login.
    """
    auth_provider_id = payload.get("sub")
    if not auth_provider_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token: missing sub claim")

    email = payload.get("email") or payload.get("email_address", "")
    name = (
        payload.get("name")
        or f"{payload.get('first_name', '')} {payload.get('last_name', '')}".strip()
        or payload.get("username", "")
        or ""
    )

    user_repo = UserRepository(db)
    upsert_data = UserUpsert(
        auth_provider_id=auth_provider_id,
        email=email or f"{auth_provider_id}@clerk.local",
        name=name or None,
        avatar_url=payload.get("image_url") or payload.get("picture"),
    )
    user = await user_repo.upsert(upsert_data)

    # Auto-join default org
    await _auto_join_default_org(user.id, db)

    return user


@router.get("/me", response_model=UserRead)
async def get_me(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Return the current authenticated user's profile."""
    user_repo = UserRepository(db)
    user = await user_repo.get_by_auth_provider_id(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user
