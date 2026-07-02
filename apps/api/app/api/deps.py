"""
Shared FastAPI dependencies for common guard patterns.

Import from here instead of duplicating per-router:
- get_user_or_401: resolve Clerk auth_provider_id → User row or 401
- get_project_or_404: fetch Project by id or 404
- get_ready_project: same as above + enforces ingestion_status == "completed"
"""
import uuid
from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.security import get_current_user_id
from app.models.project import Project
from app.models.user import User
from app.repositories.project_repository import ProjectRepository
from app.repositories.user_repository import UserRepository


async def get_user_or_401(
    user_auth_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Resolve the authenticated Clerk user to a DB User row, or raise 401."""
    repo = UserRepository(db)
    user = await repo.get_by_auth_provider_id(user_auth_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not registered",
        )
    return user


async def get_project_or_404(project_id: uuid.UUID, db: AsyncSession) -> Project:
    """Fetch a project by id, or raise 404."""
    repo = ProjectRepository(db)
    project = await repo.get_by_id(project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


async def get_ready_project(project_id: uuid.UUID, db: AsyncSession) -> Project:
    """Fetch a project and verify ingestion is complete, or raise 404/400."""
    project = await get_project_or_404(project_id, db)
    if project.ingestion_status != "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Project memory not ready (status: {project.ingestion_status}). Run ingestion first.",
        )
    return project
