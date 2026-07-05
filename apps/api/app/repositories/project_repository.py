import uuid
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.project import Project, ProjectMember
from app.models.ingestion import IngestionJob
from app.schemas.project import ProjectCreate


class ProjectRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(
        self, data: ProjectCreate, organization_id: uuid.UUID, created_by: uuid.UUID
    ) -> Project:
        project = Project(
            organization_id=organization_id,
            name=data.name,
            description=data.description,
            repo_url=data.repo_url,
            repo_default_branch=data.repo_default_branch,
            ingestion_status="not_started",
            created_by=created_by,
            created_at=datetime.now(timezone.utc),
        )
        self.db.add(project)
        # Auto-add creator as lead
        await self.db.flush()  # get the project.id
        member = ProjectMember(
            project_id=project.id,
            user_id=created_by,
            role="lead",
            added_at=datetime.now(timezone.utc),
        )
        self.db.add(member)
        await self.db.commit()
        await self.db.refresh(project)
        return project

    async def get_by_id(self, project_id: uuid.UUID) -> Project | None:
        result = await self.db.execute(select(Project).where(Project.id == project_id))
        return result.scalar_one_or_none()

    async def list_by_org(self, organization_id: uuid.UUID) -> list[Project]:
        result = await self.db.execute(
            select(Project)
            .where(Project.organization_id == organization_id)
            .order_by(Project.created_at.desc())
        )
        return list(result.scalars().all())

    async def update_ingestion_status(self, project_id: uuid.UUID, status: str) -> None:
        project = await self.get_by_id(project_id)
        if not project:
            raise ValueError(f"Project {project_id} not found — cannot update ingestion status")
        project.ingestion_status = status
        await self.db.commit()

    async def set_working_copy_path(self, project_id: uuid.UUID, path: str) -> None:
        project = await self.get_by_id(project_id)
        if not project:
            raise ValueError(f"Project {project_id} not found")
        project.working_copy_path = path
        await self.db.commit()

    async def set_cognee_dataset_id(self, project_id: uuid.UUID, dataset_id: str) -> None:
        project = await self.get_by_id(project_id)
        if not project:
            raise ValueError(f"Project {project_id} not found — cannot set cognee_dataset_id")
        project.cognee_dataset_id = dataset_id
        await self.db.commit()

    async def create_ingestion_job(self, project_id: uuid.UUID) -> IngestionJob:
        job = IngestionJob(
            project_id=project_id,
            status="queued",
            created_at=datetime.now(timezone.utc),
        )
        self.db.add(job)
        await self.db.commit()
        await self.db.refresh(job)
        return job

    async def get_latest_ingestion_job(self, project_id: uuid.UUID) -> IngestionJob | None:
        result = await self.db.execute(
            select(IngestionJob)
            .where(IngestionJob.project_id == project_id)
            .order_by(IngestionJob.created_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def update_ingestion_job(
        self,
        job_id: uuid.UUID,
        status: str,
        files_processed: int = 0,
        error_message: str | None = None,
        finished: bool = False,
    ) -> None:
        result = await self.db.execute(select(IngestionJob).where(IngestionJob.id == job_id))
        job = result.scalar_one_or_none()
        if job:
            job.status = status
            job.files_processed = files_processed
            if error_message:
                job.error_message = error_message
            if job.started_at is None:
                job.started_at = datetime.now(timezone.utc)
            if finished:
                job.finished_at = datetime.now(timezone.utc)
            await self.db.commit()
