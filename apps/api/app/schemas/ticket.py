import uuid
from datetime import datetime
from pydantic import BaseModel, Field


class TicketCreate(BaseModel):
    title: str
    description: str | None = None
    category: str | None = None
    assigned_to: uuid.UUID | None = None
    source: str = "manual"


class TicketUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    category: str | None = None
    assigned_to: uuid.UUID | None = None
    progress: int | None = Field(default=None, ge=0, le=100)


class TicketRead(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    title: str
    description: str | None
    category: str | None
    assigned_to: uuid.UUID | None
    assigned_by: uuid.UUID | None
    progress: int
    source: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AgentActionRead(BaseModel):
    id: uuid.UUID
    ticket_id: uuid.UUID | None
    project_id: uuid.UUID
    employee_id: uuid.UUID
    prompt: str
    file_path: str | None
    diff_summary: str | None
    progress_before: int | None
    progress_after: int | None
    created_at: datetime

    model_config = {"from_attributes": True}
