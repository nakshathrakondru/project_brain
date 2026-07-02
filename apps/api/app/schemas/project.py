import uuid
from datetime import datetime
from pydantic import BaseModel


class ProjectCreate(BaseModel):
    name: str
    description: str | None = None
    repo_url: str | None = None
    repo_default_branch: str = "main"


class ProjectRead(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    name: str
    description: str | None
    repo_url: str | None
    repo_default_branch: str | None
    ingestion_status: str
    created_by: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class ProjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    repo_url: str | None = None
    repo_default_branch: str | None = None
