import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel

from app.core.db import get_db
from app.core.security import get_current_user_id
from app.repositories.project_repository import ProjectRepository
from app.models.task import Task
from app.models.conversation import AIConversation
from app.models.ingestion import IngestionJob

router = APIRouter(tags=["dashboard"])


class DashboardMetrics(BaseModel):
    project_id: uuid.UUID
    ingestion_status: str
    tasks_total: int
    tasks_todo: int
    tasks_in_progress: int
    tasks_done: int
    ai_questions_asked: int
    files_ingested: int
    memory_ready: bool


@router.get("/projects/{project_id}/dashboard", response_model=DashboardMetrics)
async def get_dashboard(
    project_id: uuid.UUID,
    user_auth_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Manager dashboard: aggregated health and activity metrics.
    All metrics are computable from existing Postgres data.
    """
    project_repo = ProjectRepository(db)
    project = await project_repo.get_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Task counts
    task_counts = await db.execute(
        select(Task.status, func.count(Task.id).label("count"))
        .where(Task.project_id == project_id)
        .group_by(Task.status)
    )
    counts_map = {row.status: row.count for row in task_counts}

    # AI usage
    ai_count_result = await db.execute(
        select(func.count(AIConversation.id)).where(AIConversation.project_id == project_id)
    )
    ai_count = ai_count_result.scalar_one() or 0

    # Files ingested (from latest completed job)
    latest_job = await project_repo.get_latest_ingestion_job(project_id)
    files_ingested = latest_job.files_processed if latest_job else 0

    tasks_total = sum(counts_map.values())

    return DashboardMetrics(
        project_id=project_id,
        ingestion_status=project.ingestion_status,
        tasks_total=tasks_total,
        tasks_todo=counts_map.get("todo", 0),
        tasks_in_progress=counts_map.get("in_progress", 0),
        tasks_done=counts_map.get("done", 0),
        ai_questions_asked=ai_count,
        files_ingested=files_ingested,
        memory_ready=project.ingestion_status == "completed",
    )
