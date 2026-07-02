import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.db import get_db
from app.core.security import get_current_user_id
from app.api.deps import get_user_or_401
from app.models.organization import Organization, OrganizationMember
from app.repositories.user_repository import UserRepository
from app.schemas.organization import OrganizationCreate, OrganizationRead, InviteMemberRequest

router = APIRouter(prefix="/organizations", tags=["organizations"])


@router.post("", response_model=OrganizationRead, status_code=status.HTTP_201_CREATED)
async def create_organization(
    data: OrganizationCreate,
    user_auth_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    user = await get_user_or_401(user_auth_id, db)

    # Check slug uniqueness
    existing = await db.execute(
        select(Organization).where(Organization.slug == data.slug)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Slug already taken")

    org = Organization(name=data.name, slug=data.slug, created_at=datetime.now(timezone.utc))
    db.add(org)
    await db.flush()

    # Auto-add creator as owner
    member = OrganizationMember(
        organization_id=org.id,
        user_id=user.id,
        role="owner",
        joined_at=datetime.now(timezone.utc),
    )
    db.add(member)
    await db.commit()
    await db.refresh(org)
    return org


@router.get("/{org_id}", response_model=OrganizationRead)
async def get_organization(
    org_id: uuid.UUID,
    user_auth_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org


@router.post("/{org_id}/invite", status_code=status.HTTP_201_CREATED)
async def invite_member(
    org_id: uuid.UUID,
    data: InviteMemberRequest,
    user_auth_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Invite a user (by email) to the organization. User must already exist in our DB."""
    user_repo = UserRepository(db)
    invitee = await user_repo.get_by_email(data.email)
    if not invitee:
        raise HTTPException(status_code=404, detail="User with that email not found")

    # Check not already a member
    existing = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.organization_id == org_id,
            OrganizationMember.user_id == invitee.id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="User is already a member")

    member = OrganizationMember(
        organization_id=org_id,
        user_id=invitee.id,
        role=data.role,
        invited_at=datetime.now(timezone.utc),
        joined_at=datetime.now(timezone.utc),  # auto-join for hackathon simplicity
    )
    db.add(member)
    await db.commit()
    return {"message": f"User {data.email} added to organization"}
