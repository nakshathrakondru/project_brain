import uuid
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.security import get_current_user_id
from app.api.deps import get_ready_project
from app.schemas.onboarding import OnboardingResponse
from app.services import ai_service

router = APIRouter(tags=["onboarding"])


@router.get("/projects/{project_id}/onboarding", response_model=OnboardingResponse)
async def get_onboarding(
    project_id: uuid.UUID,
    user_auth_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Generates a personalized onboarding guide for a new developer.
    Uses the project's full memory context to produce a structured doc.
    """
    await get_ready_project(project_id, db)

    guide = await ai_service.generate_onboarding(str(project_id))
    return OnboardingResponse(project_id=project_id, guide=guide)
