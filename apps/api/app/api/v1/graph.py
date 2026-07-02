import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.security import get_current_user_id
from app.repositories.project_repository import ProjectRepository
from app.schemas.graph import GraphResponse
from app.services import memory_service

router = APIRouter(tags=["graph"])


@router.get("/projects/{project_id}/graph", response_model=GraphResponse)
async def get_knowledge_graph(
    project_id: uuid.UUID,
    node_type: str | None = Query(default=None, description="Filter by node type (File, Module, etc.)"),
    user_auth_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns the project's knowledge graph shaped for React Flow.
    Supports optional ?node_type= filter.
    """
    project_repo = ProjectRepository(db)
    project = await project_repo.get_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.ingestion_status != "completed":
        raise HTTPException(
            status_code=400,
            detail=f"Graph not ready (ingestion status: {project.ingestion_status})",
        )

    graph_data = await memory_service.get_graph_data(str(project_id))

    nodes = graph_data["nodes"]
    edges = graph_data["edges"]

    # Apply node_type filter if requested
    if node_type:
        filtered_node_ids = {n["id"] for n in nodes if n["type"].lower() == node_type.lower()}
        nodes = [n for n in nodes if n["id"] in filtered_node_ids]
        edges = [
            e for e in edges
            if e["source"] in filtered_node_ids or e["target"] in filtered_node_ids
        ]

    return GraphResponse(nodes=nodes, edges=edges)
