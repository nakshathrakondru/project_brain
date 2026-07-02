import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.core.db import get_db
from app.core.security import get_current_user_id
from app.repositories.project_repository import ProjectRepository
from app.services import ai_service

router = APIRouter(tags=["onboarding"])


class OnboardingResponse(BaseModel):
    project_id: uuid.UUID
    guide: str


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
    project_repo = ProjectRepository(db)
    project = await project_repo.get_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.ingestion_status != "completed":
        raise HTTPException(
            status_code=400,
            detail="Project memory not ready. Complete ingestion first.",
        )

    guide = await ai_service.generate_onboarding(str(project_id))
    return OnboardingResponse(project_id=project_id, guide=guide)
