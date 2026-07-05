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


class TicketSummary(BaseModel):
    id: uuid.UUID
    title: str
    category: str | None
    progress: int
    assigned_to: uuid.UUID | None
    assignee_name: str | None
    agent_actions_count: int

    model_config = {"from_attributes": True}


class EmployeeSummary(BaseModel):
    user_id: uuid.UUID
    name: str | None
    email: str | None
    tickets_assigned: int
    avg_progress: float
    agent_actions: int


class ManagerDashboard(BaseModel):
    project_id: uuid.UUID
    project_name: str
    ingestion_status: str
    memory_ready: bool
    files_ingested: int
    ai_questions_asked: int
    # Ticket stats
    tickets_total: int
    tickets_avg_progress: float
    tickets: list[TicketSummary]
    # Per-employee breakdown
    employees: list[EmployeeSummary]
    # Agent activity
    total_agent_actions: int
