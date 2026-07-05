import uuid
import logging
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db, AsyncSessionLocal
from app.core.security import get_current_user_id
from app.api.deps import get_user_or_401
from app.repositories.project_repository import ProjectRepository
from app.schemas.project import ProjectCreate, ProjectRead, ProjectUpdate
from app.schemas.ingestion import IngestionStatusResponse, IngestionJobRead
from app.services.ingestion_service import run_ingestion

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/organizations/{org_id}/projects", tags=["projects"])


@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
async def create_project(
    org_id: uuid.UUID,
    data: ProjectCreate,
    user_auth_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    user = await get_user_or_401(user_auth_id, db)
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


@router.delete("/{project_id}", status_code=204)
async def delete_project(
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    user_auth_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Delete a project and all its related data."""
    from sqlalchemy import text
    project_repo = ProjectRepository(db)
    project = await project_repo.get_by_id(project_id)
    if not project or project.organization_id != org_id:
        raise HTTPException(status_code=404, detail="Project not found")

    # Delete in dependency order to avoid FK constraint violations
    await db.execute(text("DELETE FROM agent_actions WHERE project_id = :pid").bindparams(pid=project_id))
    await db.execute(text("DELETE FROM agent_messages WHERE session_id IN (SELECT id FROM agent_sessions WHERE project_id = :pid)").bindparams(pid=project_id))
    await db.execute(text("DELETE FROM agent_sessions WHERE project_id = :pid").bindparams(pid=project_id))
    await db.execute(text("DELETE FROM chat_sessions WHERE project_id = :pid").bindparams(pid=project_id))
    await db.execute(text("DELETE FROM tickets WHERE project_id = :pid").bindparams(pid=project_id))
    await db.execute(text("DELETE FROM project_assignments WHERE project_id = :pid").bindparams(pid=project_id))
    await db.execute(text("DELETE FROM project_members WHERE project_id = :pid").bindparams(pid=project_id))
    await db.execute(text("DELETE FROM ingestion_jobs WHERE project_id = :pid").bindparams(pid=project_id))
    await db.execute(text("DELETE FROM ai_conversations WHERE project_id = :pid").bindparams(pid=project_id))
    await db.execute(text("DELETE FROM tasks WHERE project_id = :pid").bindparams(pid=project_id))
    await db.execute(text("DELETE FROM projects WHERE id = :pid").bindparams(pid=project_id))
    await db.commit()
async def update_project(
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    data: ProjectUpdate,
    user_auth_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Update project metadata (name, description, repo_url, branch)."""
    project_repo = ProjectRepository(db)
    project = await project_repo.get_by_id(project_id)
    if not project or project.organization_id != org_id:
        raise HTTPException(status_code=404, detail="Project not found")

    if data.name is not None:
        project.name = data.name
    if data.description is not None:
        project.description = data.description
    if data.repo_url is not None:
        project.repo_url = data.repo_url
        project.ingestion_status = "not_started"  # Reset so user can re-ingest
    if data.repo_default_branch is not None:
        project.repo_default_branch = data.repo_default_branch

    await db.commit()
    await db.refresh(project)
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
            try:
                await run_ingestion(project_id, job.id, bg_db)
            except Exception:
                logger.exception("Ingestion background task failed for project %s", project_id)

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
