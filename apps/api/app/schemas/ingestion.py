import uuid
from datetime import datetime
from pydantic import BaseModel


class IngestionJobRead(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    status: str
    started_at: datetime | None
    finished_at: datetime | None
    files_processed: int
    error_message: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class IngestionStatusResponse(BaseModel):
    project_id: uuid.UUID
    ingestion_status: str  # current status from projects table
    latest_job: IngestionJobRead | None
