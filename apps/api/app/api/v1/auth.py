"""
Auth endpoints — thin wrappers around Clerk.
The frontend handles sign-in/sign-up via Clerk SDK directly.
These endpoints handle: user upsert on first login, and returning the current user.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.security import get_current_user_id, verify_clerk_token
from app.repositories.user_repository import UserRepository
from app.schemas.user import UserRead, UserUpsert

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/me", response_model=UserRead)
async def upsert_current_user(
    payload: dict = Depends(verify_clerk_token),
    db: AsyncSession = Depends(get_db),
):
    """
    Called by the frontend after Clerk login to register/sync the user in our DB.
    Extracts identity from the verified Clerk JWT and upserts the user row.
    """
    user_repo = UserRepository(db)
    upsert_data = UserUpsert(
        auth_provider_id=payload["sub"],
        email=payload.get("email", ""),
        name=payload.get("name") or payload.get("first_name", ""),
        avatar_url=payload.get("image_url") or payload.get("picture"),
    )
    user = await user_repo.upsert(upsert_data)
    return user


@router.get("/me", response_model=UserRead)
async def get_me(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Return the current authenticated user's profile."""
    from fastapi import HTTPException, status

    user_repo = UserRepository(db)
    user = await user_repo.get_by_auth_provider_id(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user
