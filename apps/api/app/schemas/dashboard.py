import uuid
from pydantic import BaseModel


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
