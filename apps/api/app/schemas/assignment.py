import uuid
from datetime import datetime
from pydantic import BaseModel


class AssignProjectRequest(BaseModel):
    employee_id: uuid.UUID


class ProjectAssignmentRead(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    employee_id: uuid.UUID
    assigned_by: uuid.UUID
    assigned_at: datetime

    model_config = {"from_attributes": True}


class OrgMemberRead(BaseModel):
    user_id: uuid.UUID
    role: str
    email: str | None = None
    name: str | None = None

    model_config = {"from_attributes": True}
