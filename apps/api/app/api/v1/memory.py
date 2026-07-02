"""
Memory API — /ask (AI Tech Lead) and /search (Smart Search).
These are separate endpoints with different UX contracts:
- /ask: LLM synthesis in the loop, returns a natural-language answer
- /search: No LLM, returns ranked node list — faster and cheaper
"""
import uuid
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.security import get_current_user_id
from app.api.deps import get_ready_project, get_user_or_401
from app.schemas.memory import AskRequest, AskResponse, SearchResponse, SearchResult
from app.services import ai_service, memory_service

router = APIRouter(tags=["memory"])


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
    await get_ready_project(project_id, db)
    user = await get_user_or_401(user_auth_id, db)

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
    await get_ready_project(project_id, db)

    raw_results = await memory_service.search(
        project_id=str(project_id),
        query=q,
        search_type="chunks",
        limit=limit,
    )

    results = [SearchResult(**r) for r in raw_results]
    return SearchResponse(query=q, results=results)
