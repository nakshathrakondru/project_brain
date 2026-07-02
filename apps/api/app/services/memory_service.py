"""
Memory Engine Adapter — the ONLY module that imports and talks to Cognee.

All other services go through this interface. This is the choke point
that lets us swap Cognee, add caching, or enforce access control in one place.

Uses Cognee v1.x API:  cognee.remember() / cognee.recall()
"""
import os
import cognee
from app.core.config import get_settings

settings = get_settings()


async def setup_cognee() -> None:
    """
    Cognee v1.x is configured via environment variables (LLM_MODEL, LLM_API_KEY,
    EMBEDDING_MODEL, EMBEDDING_API_KEY). These are set in docker-compose.yml.

    Groq is used for LLM. OpenAI is used for embeddings (Groq doesn't offer them).
    """
    has_groq = bool(settings.groq_api_key and not settings.groq_api_key.startswith("placeholder"))
    has_oai  = bool(settings.openai_api_key and not settings.openai_api_key.startswith("sk-placeholder"))
    print(f"✓ Cognee configured (Groq key: {has_groq}, OpenAI embeddings key: {has_oai})")


def _dataset_name(project_id: str) -> str:
    """Consistent dataset naming — each project gets an isolated namespace."""
    return f"project_{project_id}"


async def write_text(project_id: str, text: str, metadata: dict | None = None) -> None:
    """Add a single text document to a project's memory."""
    dataset = _dataset_name(project_id)
    await cognee.remember(text, dataset_name=dataset)


async def write_nodes(project_id: str, documents: list[dict]) -> None:
    """
    Bulk-write structured documents into Cognee.
    Each document: {'type': str, 'id': str, 'content': str}
    Cognee v1.x processes all text together in one remember() call.
    """
    dataset = _dataset_name(project_id)
    texts = [
        doc.get("content", "")
        for doc in documents
        if doc.get("content", "").strip()
    ]
    if not texts:
        return
    # remember() accepts a list of strings in v1.x
    await cognee.remember(texts, dataset_name=dataset)


async def search(
    project_id: str,
    query: str,
    search_type: str = "insights",
    limit: int = 10,
) -> list[dict]:
    """
    Search the project's knowledge graph via cognee.recall().
    Returns a normalized list of result dicts.
    """
    dataset = _dataset_name(project_id)

    try:
        results = await cognee.recall(
            query_text=query,
            datasets=[dataset],
            top_k=limit,
        )
    except Exception as e:
        # recall() raises if no data has been ingested yet
        err_str = str(e).lower()
        if "not created" in err_str or "precondition" in err_str or "not found" in err_str:
            return []
        raise

    normalized: list[dict] = []
    for r in results:
        if hasattr(r, "source"):
            if r.source == "graph":
                normalized.append({
                    "node_id": str(getattr(r, "metadata", {}).get("chunk_id", id(r))),
                    "node_type": str(getattr(r, "kind", "unknown")),
                    "title": str(getattr(r, "text", query[:50]))[:80],
                    "snippet": str(getattr(r, "text", ""))[:500],
                    "score": getattr(r, "score", None),
                })
            elif r.source == "session":
                normalized.append({
                    "node_id": str(getattr(r, "qa_id", id(r))),
                    "node_type": "Conversation",
                    "title": str(getattr(r, "question", query[:50]))[:80],
                    "snippet": str(getattr(r, "answer", ""))[:500],
                    "score": None,
                })
        elif isinstance(r, dict):
            normalized.append({
                "node_id": str(r.get("id", "")),
                "node_type": r.get("type", "unknown"),
                "title": r.get("name", r.get("title", query[:50]))[:80],
                "snippet": str(r.get("text", r.get("content", "")))[:500],
                "score": r.get("score"),
            })

    return normalized[:limit]


async def get_graph_data(project_id: str) -> dict:
    """
    Pull graph data from Cognee for React Flow visualization.
    Uses recall() with a broad query to surface nodes and relationships.
    """
    dataset = _dataset_name(project_id)

    try:
        results = await cognee.recall(
            query_text="project architecture files modules",
            datasets=[dataset],
            top_k=50,
        )
    except Exception:
        return {"nodes": [], "edges": []}

    nodes: list[dict] = []
    edges: list[dict] = []
    seen: set[str] = set()

    for r in results:
        r_dict = r.__dict__ if hasattr(r, "__dict__") else (r if isinstance(r, dict) else {})

        node_id = str(r_dict.get("id", id(r)))
        if node_id not in seen:
            seen.add(node_id)
            nodes.append({
                "id": node_id,
                "type": r_dict.get("kind", r_dict.get("type", "Node")),
                "label": str(r_dict.get("text", r_dict.get("name", node_id)))[:40],
                "data": {},
            })

        for edge in r_dict.get("edges", []):
            e = edge if isinstance(edge, dict) else edge.__dict__
            edges.append({
                "id": f"{e.get('source')}_{e.get('target')}",
                "source": str(e.get("source", "")),
                "target": str(e.get("target", "")),
                "label": e.get("relationship_name", "related_to"),
            })

    return {"nodes": nodes, "edges": edges}


async def smoke_test() -> bool:
    """Quick connectivity check — write a node and recall it."""
    try:
        await cognee.remember(
            "Project Brain smoke test node",
            dataset_name="smoke_test",
        )
        results = await cognee.recall(
            query_text="smoke test",
            datasets=["smoke_test"],
            top_k=1,
        )
        return len(results) > 0
    except Exception as e:
        print(f"Cognee smoke test failed: {e}")
        return False
