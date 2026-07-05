import uuid
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.db import get_db
from app.core.security import get_current_user_id
from app.api.deps import get_project_or_404
from app.models.task import Task
from app.models.ticket import Ticket, AgentAction
from app.models.conversation import AIConversation
from app.models.user import User
from app.repositories.project_repository import ProjectRepository
from app.schemas.dashboard import DashboardMetrics, ManagerDashboard, TicketSummary, EmployeeSummary

router = APIRouter(tags=["dashboard"])


@router.get("/projects/{project_id}/dashboard", response_model=DashboardMetrics)
async def get_dashboard(
    project_id: uuid.UUID,
    user_auth_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Legacy dashboard — task-based metrics (kept for backward compat)."""
    project = await get_project_or_404(project_id, db)

    task_counts = await db.execute(
        select(Task.status, func.count(Task.id).label("count"))
        .where(Task.project_id == project_id)
        .group_by(Task.status)
    )
    counts_map = {row.status: row.count for row in task_counts}

    ai_count_result = await db.execute(
        select(func.count(AIConversation.id)).where(AIConversation.project_id == project_id)
    )
    ai_count = ai_count_result.scalar_one() or 0

    project_repo = ProjectRepository(db)
    latest_job = await project_repo.get_latest_ingestion_job(project_id)
    files_ingested = latest_job.files_processed if latest_job else 0
    tasks_total = sum(counts_map.values())

    return DashboardMetrics(
        project_id=project_id,
        ingestion_status=project.ingestion_status,
        tasks_total=tasks_total,
        tasks_todo=counts_map.get("todo", 0),
        tasks_in_progress=counts_map.get("in_progress", 0),
        tasks_done=counts_map.get("done", 0),
        ai_questions_asked=ai_count,
        files_ingested=files_ingested,
        memory_ready=project.ingestion_status == "completed",
    )


@router.get("/projects/{project_id}/manager-dashboard", response_model=ManagerDashboard)
async def get_manager_dashboard(
    project_id: uuid.UUID,
    user_auth_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    New manager dashboard — ticket progress + per-employee breakdown.
    Polls every few seconds from the frontend for real-time feel.
    """
    project = await get_project_or_404(project_id, db)

    project_repo = ProjectRepository(db)
    latest_job = await project_repo.get_latest_ingestion_job(project_id)
    files_ingested = latest_job.files_processed if latest_job else 0

    # AI questions
    ai_count = (await db.execute(
        select(func.count(AIConversation.id)).where(AIConversation.project_id == project_id)
    )).scalar_one() or 0

    # All tickets for this project
    ticket_rows = (await db.execute(
        select(Ticket).where(Ticket.project_id == project_id).order_by(Ticket.created_at)
    )).scalars().all()

    # Agent action counts per ticket
    action_counts = {}
    action_rows = (await db.execute(
        select(AgentAction.ticket_id, func.count(AgentAction.id).label("cnt"))
        .where(AgentAction.project_id == project_id)
        .group_by(AgentAction.ticket_id)
    )).all()
    for row in action_rows:
        if row.ticket_id:
            action_counts[row.ticket_id] = row.cnt

    # Total agent actions
    total_actions = (await db.execute(
        select(func.count(AgentAction.id)).where(AgentAction.project_id == project_id)
    )).scalar_one() or 0

    # User lookup for assignee names
    user_ids = {t.assigned_to for t in ticket_rows if t.assigned_to}
    users_map: dict[uuid.UUID, User] = {}
    if user_ids:
        user_rows = (await db.execute(
            select(User).where(User.id.in_(user_ids))
        )).scalars().all()
        users_map = {u.id: u for u in user_rows}

    # Build ticket summaries
    ticket_summaries = [
        TicketSummary(
            id=t.id,
            title=t.title,
            category=t.category,
            progress=t.progress,
            assigned_to=t.assigned_to,
            assignee_name=users_map.get(t.assigned_to).name if t.assigned_to and t.assigned_to in users_map else None,
            agent_actions_count=action_counts.get(t.id, 0),
        )
        for t in ticket_rows
    ]

    avg_progress = (
        sum(t.progress for t in ticket_rows) / len(ticket_rows)
        if ticket_rows else 0.0
    )

    # Per-employee breakdown
    employee_stats: dict[uuid.UUID, dict] = {}
    for t in ticket_rows:
        if not t.assigned_to:
            continue
        uid = t.assigned_to
        if uid not in employee_stats:
            u = users_map.get(uid)
            employee_stats[uid] = {
                "user_id": uid,
                "name": u.name if u else None,
                "email": u.email if u else None,
                "tickets": [],
                "agent_actions": 0,
            }
        employee_stats[uid]["tickets"].append(t.progress)
        employee_stats[uid]["agent_actions"] += action_counts.get(t.id, 0)

    employees = [
        EmployeeSummary(
            user_id=v["user_id"],
            name=v["name"],
            email=v["email"],
            tickets_assigned=len(v["tickets"]),
            avg_progress=sum(v["tickets"]) / len(v["tickets"]) if v["tickets"] else 0.0,
            agent_actions=v["agent_actions"],
        )
        for v in employee_stats.values()
    ]

    return ManagerDashboard(
        project_id=project_id,
        project_name=project.name,
        ingestion_status=project.ingestion_status,
        memory_ready=project.ingestion_status == "completed",
        files_ingested=files_ingested,
        ai_questions_asked=ai_count,
        tickets_total=len(ticket_rows),
        tickets_avg_progress=round(avg_progress, 1),
        tickets=ticket_summaries,
        employees=employees,
        total_agent_actions=total_actions,
    )
