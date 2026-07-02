import uuid
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db, AsyncSessionLocal
from app.core.security import get_current_user_id
from app.repositories.project_repository import ProjectRepository
from app.repositories.user_repository import UserRepository
from app.schemas.project import ProjectCreate, ProjectRead
from app.schemas.ingestion import IngestionStatusResponse, IngestionJobRead
from app.services.ingestion_service import run_ingestion

router = APIRouter(prefix="/organizations/{org_id}/projects", tags=["projects"])


async def _resolve_user(user_auth_id: str, db: AsyncSession):
    repo = UserRepository(db)
    user = await repo.get_by_auth_provider_id(user_auth_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not registered")
    return user


@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
async def create_project(
    org_id: uuid.UUID,
    data: ProjectCreate,
    user_auth_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    user = await _resolve_user(user_auth_id, db)
    project_repo = ProjectRepository(db)
    project = await project_repo.create(data, organization_id=org_id, created_by=user.id)
    return project


@router.get("", response_model=list[ProjectRead])
async def list_projects(
    org_id: uuid.UUID,
    user_auth_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    project_repo = ProjectRepository(db)
    return await project_repo.list_by_org(org_id)


@router.get("/{project_id}", response_model=ProjectRead)
async def get_project(
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    user_auth_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    project_repo = ProjectRepository(db)
    project = await project_repo.get_by_id(project_id)
    if not project or project.organization_id != org_id:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.post("/{project_id}/ingest", status_code=status.HTTP_202_ACCEPTED)
async def start_ingestion(
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    user_auth_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Kick off GitHub repo ingestion as a background task.
    Returns immediately with the job ID. Poll /ingest/status for progress.
    """
    project_repo = ProjectRepository(db)
    project = await project_repo.get_by_id(project_id)
    if not project or project.organization_id != org_id:
        raise HTTPException(status_code=404, detail="Project not found")
    if not project.repo_url:
        raise HTTPException(status_code=400, detail="Project has no repo_url configured")

    job = await project_repo.create_ingestion_job(project_id)
    await project_repo.update_ingestion_status(project_id, "queued")

    async def _run_with_fresh_session():
        """Background tasks need their own DB session — the request session closes after response."""
        async with AsyncSessionLocal() as bg_db:
            await run_ingestion(project_id, job.id, bg_db)

    background_tasks.add_task(_run_with_fresh_session)

    return {"job_id": job.id, "status": "queued", "message": "Ingestion started"}


@router.get("/{project_id}/ingest/status", response_model=IngestionStatusResponse)
async def get_ingestion_status(
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    user_auth_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    project_repo = ProjectRepository(db)
    project = await project_repo.get_by_id(project_id)
    if not project or project.organization_id != org_id:
        raise HTTPException(status_code=404, detail="Project not found")

    latest_job = await project_repo.get_latest_ingestion_job(project_id)
    return IngestionStatusResponse(
        project_id=project_id,
        ingestion_status=project.ingestion_status,
        latest_job=IngestionJobRead.model_validate(latest_job) if latest_job else None,
    )
