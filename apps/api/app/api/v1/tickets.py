"""
Tickets API — replaces tasks for the new manager/employee workflow.
Tickets have a progress field (0–100) that auto-updates via agent actions.
"""
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.db import get_db
from app.core.security import get_current_user_id
from app.api.deps import get_user_or_401
from app.models.ticket import Ticket
from app.schemas.ticket import TicketCreate, TicketRead, TicketUpdate

router = APIRouter(tags=["tickets"])


@router.post("/projects/{project_id}/tickets", response_model=TicketRead, status_code=201)
async def create_ticket(
    project_id: uuid.UUID,
    data: TicketCreate,
    user_auth_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    user = await get_user_or_401(user_auth_id, db)
    ticket = Ticket(
        project_id=project_id,
        title=data.title,
        description=data.description,
        category=data.category,
        assigned_to=data.assigned_to,
        assigned_by=user.id,
        source=data.source,
        progress=0,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(ticket)
    await db.commit()
    await db.refresh(ticket)
    return ticket


@router.get("/projects/{project_id}/tickets", response_model=list[TicketRead])
async def list_tickets(
    project_id: uuid.UUID,
    user_auth_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Ticket)
        .where(Ticket.project_id == project_id)
        .order_by(Ticket.created_at.desc())
    )
    return result.scalars().all()


@router.get("/projects/{project_id}/tickets/mine", response_model=list[TicketRead])
async def list_my_tickets(
    project_id: uuid.UUID,
    user_auth_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get tickets assigned to the current user in this project."""
    user = await get_user_or_401(user_auth_id, db)
    result = await db.execute(
        select(Ticket)
        .where(Ticket.project_id == project_id, Ticket.assigned_to == user.id)
        .order_by(Ticket.created_at.desc())
    )
    return result.scalars().all()


@router.get("/projects/{project_id}/tickets/{ticket_id}", response_model=TicketRead)
async def get_ticket(
    project_id: uuid.UUID,
    ticket_id: uuid.UUID,
    user_auth_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Ticket).where(Ticket.id == ticket_id, Ticket.project_id == project_id)
    )
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return ticket


@router.patch("/projects/{project_id}/tickets/{ticket_id}", response_model=TicketRead)
async def update_ticket(
    project_id: uuid.UUID,
    ticket_id: uuid.UUID,
    data: TicketUpdate,
    user_auth_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Ticket).where(Ticket.id == ticket_id, Ticket.project_id == project_id)
    )
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if data.title is not None:
        ticket.title = data.title
    if data.description is not None:
        ticket.description = data.description
    if data.category is not None:
        ticket.category = data.category
    if data.assigned_to is not None:
        ticket.assigned_to = data.assigned_to
    if data.progress is not None:
        ticket.progress = data.progress
    ticket.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(ticket)
    return ticket


@router.delete("/projects/{project_id}/tickets/{ticket_id}", status_code=204)
async def delete_ticket(
    project_id: uuid.UUID,
    ticket_id: uuid.UUID,
    user_auth_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Ticket).where(Ticket.id == ticket_id, Ticket.project_id == project_id)
    )
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    await db.delete(ticket)
    await db.commit()
