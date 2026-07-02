import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.security import get_current_user_id
from app.repositories.project_repository import ProjectRepository
from app.repositories.task_repository import TaskRepository
from app.schemas.task import (
    TaskCreate,
    TaskRead,
    TaskStatusUpdate,
    TaskGenerateRequest,
    TaskGenerateResponse,
)
from app.services import ai_service

router = APIRouter(tags=["tasks"])


@router.get("/projects/{project_id}/tasks", response_model=list[TaskRead])
async def list_tasks(
    project_id: uuid.UUID,
    user_auth_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    task_repo = TaskRepository(db)
    return await task_repo.list_by_project(project_id)


@router.post("/projects/{project_id}/tasks", response_model=TaskRead, status_code=status.HTTP_201_CREATED)
async def create_task(
    project_id: uuid.UUID,
    data: TaskCreate,
    user_auth_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    task_repo = TaskRepository(db)
    return await task_repo.create(data, project_id)


@router.patch("/projects/{project_id}/tasks/{task_id}", response_model=TaskRead)
async def update_task_status(
    project_id: uuid.UUID,
    task_id: uuid.UUID,
    data: TaskStatusUpdate,
    user_auth_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    task_repo = TaskRepository(db)
    task = await task_repo.update_status(task_id, data.status)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    # Verify the task actually belongs to this project
    if task.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return task


@router.post("/projects/{project_id}/tasks/generate", response_model=TaskGenerateResponse)
async def generate_tasks(
    project_id: uuid.UUID,
    request: TaskGenerateRequest,
    user_auth_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    AI Task Generator: given a feature description, generate a structured task list
    grounded in the project's knowledge graph.
    """
    project_repo = ProjectRepository(db)
    project = await project_repo.get_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    raw_tasks = await ai_service.generate_tasks(
        project_id=str(project_id),
        feature_description=request.feature_description,
    )

    if not raw_tasks:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI failed to generate tasks. The model may have returned malformed output — try again.",
        )

    task_repo = TaskRepository(db)
    task_creates = [
        TaskCreate(
            title=t.get("title", "Untitled task"),
            description=t.get("description"),
            category=t.get("category"),
            source="ai_generated",
        )
        for t in raw_tasks
    ]
    saved_tasks = await task_repo.create_many(task_creates, project_id)
    return TaskGenerateResponse(tasks=[TaskRead.model_validate(t) for t in saved_tasks])
