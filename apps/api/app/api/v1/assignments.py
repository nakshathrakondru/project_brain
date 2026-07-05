"""
Assignment API — manager assigns projects to employees, views org members.
"""
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.db import get_db
from app.core.security import get_current_user_id
from app.api.deps import get_user_or_401
from app.models.assignment import ProjectAssignment
from app.models.organization import OrganizationMember
from app.models.user import User
from app.schemas.assignment import AssignProjectRequest, ProjectAssignmentRead, OrgMemberRead

router = APIRouter(tags=["assignments"])


@router.get("/organizations/{org_id}/members", response_model=list[OrgMemberRead])
async def list_org_members(
    org_id: uuid.UUID,
    user_auth_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """List all members of an organization with their roles."""
    result = await db.execute(
        select(OrganizationMember, User)
        .join(User, OrganizationMember.user_id == User.id)
        .where(OrganizationMember.organization_id == org_id)
    )
    rows = result.all()
    return [
        OrgMemberRead(
            user_id=member.user_id,
            role=member.role,
            email=user.email,
            name=user.name,
        )
        for member, user in rows
    ]


@router.post("/projects/{project_id}/assign", response_model=ProjectAssignmentRead, status_code=201)
async def assign_project(
    project_id: uuid.UUID,
    data: AssignProjectRequest,
    user_auth_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Manager assigns a project to an employee."""
    manager = await get_user_or_401(user_auth_id, db)

    # Check not already assigned
    existing = await db.execute(
        select(ProjectAssignment).where(
            ProjectAssignment.project_id == project_id,
            ProjectAssignment.employee_id == data.employee_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Employee already assigned to this project")

    assignment = ProjectAssignment(
        project_id=project_id,
        employee_id=data.employee_id,
        assigned_by=manager.id,
        assigned_at=datetime.now(timezone.utc),
    )
    db.add(assignment)
    await db.commit()
    await db.refresh(assignment)
    return assignment


@router.delete("/projects/{project_id}/assign/{employee_id}", status_code=204)
async def unassign_project(
    project_id: uuid.UUID,
    employee_id: uuid.UUID,
    user_auth_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ProjectAssignment).where(
            ProjectAssignment.project_id == project_id,
            ProjectAssignment.employee_id == employee_id,
        )
    )
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    await db.delete(assignment)
    await db.commit()


@router.get("/projects/{project_id}/assignments", response_model=list[ProjectAssignmentRead])
async def list_project_assignments(
    project_id: uuid.UUID,
    user_auth_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ProjectAssignment).where(ProjectAssignment.project_id == project_id)
    )
    return result.scalars().all()


@router.get("/users/me/assignments", response_model=list[dict])
async def get_my_assignments(
    user_auth_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Employee: get all projects assigned to me."""
    user = await get_user_or_401(user_auth_id, db)
    result = await db.execute(
        select(ProjectAssignment).where(ProjectAssignment.employee_id == user.id)
    )
    assignments = result.scalars().all()
    return [
        {
            "project_id": str(a.project_id),
            "assigned_by": str(a.assigned_by),
            "assigned_at": a.assigned_at.isoformat(),
        }
        for a in assignments
    ]
