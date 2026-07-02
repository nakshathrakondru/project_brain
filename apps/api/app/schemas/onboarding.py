import uuid
from pydantic import BaseModel


class OnboardingResponse(BaseModel):
    project_id: uuid.UUID
    guide: str
