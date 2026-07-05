"""
Sessions API — persistent chat history for AI Tech Lead and Agent.
"""
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.core.db import get_db
from app.core.security import get_current_user_id
from app.api.deps import get_user_or_401
from app.models.session import ChatSession, AgentSession, AgentMessage
from app.models.conversation import AIConversation

router = APIRouter(tags=["sessions"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class SessionRead(BaseModel):
    id: uuid.UUID
    title: str
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class MessageRead(BaseModel):
    id: uuid.UUID
    role: str
    content: str
    file_path: str | None = None
    written_to_memory: bool = False
    ticket_progress: int | None = None
    created_at: datetime
    model_config = {"from_attributes": True}


class ConversationRead(BaseModel):
    id: uuid.UUID
    question: str
    answer: str
    created_at: datetime
    model_config = {"from_attributes": True}


class RenameRequest(BaseModel):
    title: str


# ── Chat Sessions (AI Tech Lead) ──────────────────────────────────────────────

@router.get("/projects/{project_id}/chat-sessions", response_model=list[SessionRead])
async def list_chat_sessions(
    project_id: uuid.UUID,
    user_auth_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    user = await get_user_or_401(user_auth_id, db)
    result = await db.execute(
        select(ChatSession)
        .where(ChatSession.project_id == project_id, ChatSession.user_id == user.id)
        .order_by(ChatSession.updated_at.desc())
    )
    return result.scalars().all()


@router.post("/projects/{project_id}/chat-sessions", response_model=SessionRead, status_code=201)
async def create_chat_session(
    project_id: uuid.UUID,
    user_auth_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    user = await get_user_or_401(user_auth_id, db)
    session = ChatSession(
        project_id=project_id,
        user_id=user.id,
        title="New chat",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


@router.patch("/projects/{project_id}/chat-sessions/{session_id}", response_model=SessionRead)
async def rename_chat_session(
    project_id: uuid.UUID,
    session_id: uuid.UUID,
    body: RenameRequest,
    user_auth_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ChatSession).where(ChatSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.title = body.title[:60]
    session.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(session)
    return session


@router.delete("/projects/{project_id}/chat-sessions/{session_id}", status_code=204)
async def delete_chat_session(
    project_id: uuid.UUID,
    session_id: uuid.UUID,
    user_auth_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ChatSession).where(ChatSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    await db.delete(session)
    await db.commit()


@router.get("/projects/{project_id}/chat-sessions/{session_id}/messages", response_model=list[ConversationRead])
async def get_chat_history(
    project_id: uuid.UUID,
    session_id: uuid.UUID,
    user_auth_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AIConversation)
        .where(AIConversation.session_id == session_id)
        .order_by(AIConversation.created_at)
    )
    return result.scalars().all()


# ── Agent Sessions (Code Editor) ─────────────────────────────────────────────

@router.get("/projects/{project_id}/agent-sessions", response_model=list[SessionRead])
async def list_agent_sessions(
    project_id: uuid.UUID,
    user_auth_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    user = await get_user_or_401(user_auth_id, db)
    result = await db.execute(
        select(AgentSession)
        .where(AgentSession.project_id == project_id, AgentSession.user_id == user.id)
        .order_by(AgentSession.updated_at.desc())
    )
    return result.scalars().all()


@router.post("/projects/{project_id}/agent-sessions", response_model=SessionRead, status_code=201)
async def create_agent_session(
    project_id: uuid.UUID,
    user_auth_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    user = await get_user_or_401(user_auth_id, db)
    session = AgentSession(
        project_id=project_id,
        user_id=user.id,
        title="New session",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


@router.patch("/projects/{project_id}/agent-sessions/{session_id}", response_model=SessionRead)
async def rename_agent_session(
    project_id: uuid.UUID,
    session_id: uuid.UUID,
    body: RenameRequest,
    user_auth_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(AgentSession).where(AgentSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.title = body.title[:60]
    session.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(session)
    return session


@router.delete("/projects/{project_id}/agent-sessions/{session_id}", status_code=204)
async def delete_agent_session(
    project_id: uuid.UUID,
    session_id: uuid.UUID,
    user_auth_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(AgentSession).where(AgentSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    await db.delete(session)
    await db.commit()


@router.get("/projects/{project_id}/agent-sessions/{session_id}/messages", response_model=list[MessageRead])
async def get_agent_history(
    project_id: uuid.UUID,
    session_id: uuid.UUID,
    user_auth_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AgentMessage)
        .where(AgentMessage.session_id == session_id)
        .order_by(AgentMessage.created_at)
    )
    return result.scalars().all()


@router.post("/projects/{project_id}/agent-sessions/{session_id}/messages", status_code=201)
async def save_agent_message(
    project_id: uuid.UUID,
    session_id: uuid.UUID,
    body: MessageRead,
    user_auth_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Save a message to an agent session (called after each agent action)."""
    # Update session timestamp
    result = await db.execute(select(AgentSession).where(AgentSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    msg = AgentMessage(
        session_id=session_id,
        role=body.role,
        content=body.content,
        file_path=body.file_path,
        written_to_memory=body.written_to_memory,
        ticket_progress=body.ticket_progress,
        created_at=datetime.now(timezone.utc),
    )
    db.add(msg)
    session.updated_at = datetime.now(timezone.utc)
    # Auto-title session from first user message
    if body.role == "user" and session.title == "New session":
        session.title = body.content[:40]
    await db.commit()
    return {"ok": True}
