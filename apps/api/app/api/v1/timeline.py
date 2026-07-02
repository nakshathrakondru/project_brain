import uuid
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.db import get_db
from app.core.security import get_current_user_id
from app.api.deps import get_project_or_404
from app.models.task import Task
from app.models.conversation import AIConversation
from app.models.ingestion import IngestionJob
from app.schemas.timeline import TimelineEvent

router = APIRouter(tags=["timeline"])


@router.get("/projects/{project_id}/timeline", response_model=list[TimelineEvent])
async def get_timeline(
    project_id: uuid.UUID,
    user_auth_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Chronological feed of memory events for a project:
    ingestion jobs, task creation/completion, and AI conversations.
    """
    await get_project_or_404(project_id, db)

    events: list[TimelineEvent] = []

    # Ingestion jobs
    jobs_result = await db.execute(
        select(IngestionJob)
        .where(IngestionJob.project_id == project_id)
        .order_by(IngestionJob.created_at.desc())
    )
    for job in jobs_result.scalars():
        events.append(TimelineEvent(
            id=str(job.id),
            type="ingestion",
            title=f"Repo ingestion {job.status}",
            description=f"{job.files_processed} files processed" if job.files_processed else None,
            timestamp=job.finished_at or job.created_at,
            metadata={"status": job.status, "files_processed": job.files_processed},
        ))

    # Tasks
    tasks_result = await db.execute(
        select(Task)
        .where(Task.project_id == project_id)
        .order_by(Task.created_at.desc())
        .limit(50)
    )
    for task in tasks_result.scalars():
        events.append(TimelineEvent(
            id=str(task.id),
            type="task_created",
            title=f"Task created: {task.title}",
            description=task.description,
            timestamp=task.created_at,
            metadata={"status": task.status, "category": task.category, "source": task.source},
        ))

    # AI Conversations
    convos_result = await db.execute(
        select(AIConversation)
        .where(AIConversation.project_id == project_id)
        .order_by(AIConversation.created_at.desc())
        .limit(50)
    )
    for convo in convos_result.scalars():
        events.append(TimelineEvent(
            id=str(convo.id),
            type="conversation",
            title=f"AI asked: {convo.question[:80]}{'...' if len(convo.question) > 80 else ''}",
            description=convo.answer[:200] if convo.answer else None,
            timestamp=convo.created_at,
        ))

    # Sort chronologically (most recent first)
    events.sort(key=lambda e: e.timestamp, reverse=True)
    return events
