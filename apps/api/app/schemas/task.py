import uuid
from datetime import datetime
from pydantic import BaseModel
from typing import Literal


TaskCategory = Literal["backend", "frontend", "database", "testing", "deployment"]
TaskStatus = Literal["todo", "in_progress", "done"]
TaskSource = Literal["ai_generated", "manual"]


class TaskCreate(BaseModel):
    title: str
    description: str | None = None
    category: TaskCategory | None = None
    source: TaskSource = "manual"


class TaskRead(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    title: str
    description: str | None
    category: str | None
    status: str
    source: str
    memory_node_id: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class TaskStatusUpdate(BaseModel):
    status: TaskStatus


class TaskGenerateRequest(BaseModel):
    feature_description: str


class TaskGenerateResponse(BaseModel):
    tasks: list[TaskRead]
