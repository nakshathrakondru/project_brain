import uuid
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.task import Task
from app.schemas.task import TaskCreate


class TaskRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, data: TaskCreate, project_id: uuid.UUID) -> Task:
        task = Task(
            project_id=project_id,
            title=data.title,
            description=data.description,
            category=data.category,
            source=data.source,
            status="todo",
            created_at=datetime.now(timezone.utc),
        )
        self.db.add(task)
        await self.db.commit()
        await self.db.refresh(task)
        return task

    async def create_many(self, tasks_data: list[TaskCreate], project_id: uuid.UUID) -> list[Task]:
        tasks = [
            Task(
                project_id=project_id,
                title=t.title,
                description=t.description,
                category=t.category,
                source=t.source,
                status="todo",
                created_at=datetime.now(timezone.utc),
            )
            for t in tasks_data
        ]
        self.db.add_all(tasks)
        await self.db.commit()
        for task in tasks:
            await self.db.refresh(task)
        return tasks

    async def list_by_project(self, project_id: uuid.UUID) -> list[Task]:
        result = await self.db.execute(
            select(Task)
            .where(Task.project_id == project_id)
            .order_by(Task.created_at.desc())
        )
        return list(result.scalars().all())

    async def update_status(self, task_id: uuid.UUID, status: str) -> Task | None:
        result = await self.db.execute(select(Task).where(Task.id == task_id))
        task = result.scalar_one_or_none()
        if task:
            task.status = status
            await self.db.commit()
            await self.db.refresh(task)
        return task

    async def set_memory_node_id(self, task_id: uuid.UUID, memory_node_id: str) -> None:
        result = await self.db.execute(select(Task).where(Task.id == task_id))
        task = result.scalar_one_or_none()
        if task:
            task.memory_node_id = memory_node_id
            await self.db.commit()
