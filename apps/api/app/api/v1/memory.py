"""
Memory API — /ask (AI Tech Lead) and /search (Smart Search).
These are separate endpoints with different UX contracts:
- /ask: LLM synthesis in the loop, returns a natural-language answer
- /search: No LLM, returns ranked node list — faster and cheaper
"""
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.security import get_current_user_id
from app.repositories.project_repository import ProjectRepository
from app.repositories.user_repository import UserRepository
from app.schemas.memory import AskRequest, AskResponse, SearchResponse, SearchResult
from app.services import ai_service, memory_service

router = APIRouter(tags=["memory"])


async def _get_project_or_404(project_id: uuid.UUID, db: AsyncSession):
    repo = ProjectRepository(db)
    project = await repo.get_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.ingestion_status not in ("completed",):
        raise HTTPException(
            status_code=400,
            detail=f"Project memory not ready (status: {project.ingestion_status}). Run ingestion first.",
        )
    return project


async def _get_user(user_auth_id: str, db: AsyncSession):
    repo = UserRepository(db)
    user = await repo.get_by_auth_provider_id(user_auth_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not registered")
    return user


@router.post("/projects/{project_id}/ask", response_model=AskResponse)
async def ask_question(
    project_id: uuid.UUID,
    request: AskRequest,
    user_auth_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    AI Tech Lead: asks a natural-language question, gets a memory-grounded answer.
    The Q&A is written back into memory as a Conversation node.
    """
    project = await _get_project_or_404(project_id, db)
    user = await _get_user(user_auth_id, db)

    result = await ai_service.ask(
        project_id=str(project_id),
        question=request.question,
        user_id=user.id,
        db=db,
    )
    return AskResponse(**result)


@router.get("/projects/{project_id}/search", response_model=SearchResponse)
async def search_memory(
    project_id: uuid.UUID,
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(default=10, le=50),
    user_auth_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Smart Search: semantic search over the project's knowledge graph.
    No LLM synthesis — returns ranked list of matching nodes directly.
    """
    project = await _get_project_or_404(project_id, db)

    raw_results = await memory_service.search(
        project_id=str(project_id),
        query=q,
        search_type="chunks",
        limit=limit,
    )

    results = [SearchResult(**r) for r in raw_results]
    return SearchResponse(query=q, results=results)
