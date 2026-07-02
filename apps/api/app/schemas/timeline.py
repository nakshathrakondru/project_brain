from datetime import datetime
from pydantic import BaseModel


class TimelineEvent(BaseModel):
    id: str
    type: str        # "task_created", "task_completed", "conversation", "ingestion"
    title: str
    description: str | None = None
    timestamp: datetime
    metadata: dict = {}
