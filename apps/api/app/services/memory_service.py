"""
Memory Engine Adapter — Cognee Cloud REST API

Uses Cognee Cloud instead of the local SDK.
All LLM/embedding heavy lifting is handled by Cognee Cloud.
"""
import httpx
from app.core.config import get_settings

settings = get_settings()

COGNEE_API_BASE = "https://tenant-ec3a22ea-92a1-4009-88ab-97210a82efc7.aws.cognee.ai/api"
COGNEE_API_KEY = "70daee09ccf3066da9321a81a612017635aa60bc3e516aff8e10336a977e52c2"


async def setup_cognee() -> None:
    """Cognee Cloud requires no local setup — just an API key."""
    print(f"✓ Cognee Cloud configured (key: ***{COGNEE_API_KEY[-8:]})")


def _dataset_name(project_id: str) -> str:
    return f"project_{project_id}"


async def write_text(project_id: str, text: str) -> None:
    """Add a single text document — just upload, skip cognify for speed."""
    dataset = _dataset_name(project_id)
    try:
        async with httpx.AsyncClient(follow_redirects=True) as client:
            await client.post(
                f"{COGNEE_API_BASE}/add",
                headers={"X-Api-Key": COGNEE_API_KEY},
                data={"datasetName": dataset},
                files={"data": ("content.txt", text.encode("utf-8"), "text/plain")},
                timeout=30,
            )
    except Exception:
        pass  # Non-critical — don't fail the request


async def write_nodes(project_id: str, documents: list[dict]) -> None:
    dataset = _dataset_name(project_id)
    texts = [
        doc.get("content", "")
        for doc in documents
        if doc.get("content", "").strip()
    ]
    if not texts:
        return

    combined = "\n\n---\n\n".join(texts)

    async with httpx.AsyncClient(follow_redirects=True) as client:
        # Step 1: Upload content
        resp = await client.post(
            f"{COGNEE_API_BASE}/add",
            headers={"X-Api-Key": COGNEE_API_KEY},
            data={"datasetName": dataset},
            files={"data": ("project_content.txt", combined.encode("utf-8"), "text/plain")},
            timeout=300,
        )
        if resp.status_code not in (200, 201, 409):
            resp.raise_for_status()

        # Step 2: Build knowledge graph
        resp = await client.post(
            f"{COGNEE_API_BASE}/cognify",
            headers={"X-Api-Key": COGNEE_API_KEY},
            json={"datasets": [dataset]},
            timeout=600,
        )
        resp.raise_for_status()


async def _cognee_search(dataset: str, query: str, timeout: int = 40) -> list:
    """Internal helper — calls Cognee Cloud search and returns raw results."""
    async with httpx.AsyncClient(follow_redirects=True) as client:
        try:
            resp = await client.post(
                f"{COGNEE_API_BASE}/search",
                headers={"X-Api-Key": COGNEE_API_KEY},
                json={
                    "query": query,
                    "searchType": "GRAPH_COMPLETION",
                    "datasets": [dataset],
                },
                timeout=timeout,
            )
            if resp.status_code != 200:
                return []
            return resp.json() if isinstance(resp.json(), list) else []
        except (httpx.TimeoutException, httpx.HTTPError):
            return []

async def search(
    project_id: str,
    query: str,
    search_type: str = "insights",
    limit: int = 10,
) -> list[dict]:
    dataset = _dataset_name(project_id)
    results = await _cognee_search(dataset, query)

    normalized: list[dict] = []
    for r in results[:limit]:
        if not isinstance(r, dict):
            continue
        search_result = r.get("search_result", "")
        if isinstance(search_result, list):
            text = " ".join(str(x) for x in search_result)
        else:
            text = str(search_result)

        if not text or "does not contain" in text.lower():
            continue

        normalized.append({
            "node_id": str(r.get("dataset_id", len(normalized))),
            "node_type": "Knowledge",
            "title": query[:80],
            "snippet": text[:500],
            "score": None,
        })

    return normalized


async def get_graph_data(project_id: str) -> dict:
    """
    Build graph visualization from Cognee Cloud — parallel queries.
    """
    dataset = _dataset_name(project_id)

    queries = [
        ("files modules classes", "File"),
        ("functions methods components", "Function"),
        ("dependencies imports libraries", "Module"),
        ("pull requests issues bugs", "PullRequest"),
        ("contributors developers team", "Developer"),
    ]

    # Run all queries in parallel to avoid sequential timeouts
    import asyncio
    results_list = await asyncio.gather(
        *[_cognee_search(dataset, q, timeout=35) for q, _ in queries],
        return_exceptions=True
    )

    nodes: list[dict] = []
    edges: list[dict] = []
    seen: set[str] = set()

    for (query, node_type), results in zip(queries, results_list):
        if isinstance(results, Exception):
            continue
        for r in results:
            if not isinstance(r, dict):
                continue
            search_result = r.get("search_result", "")
            if isinstance(search_result, list):
                text = " ".join(str(x) for x in search_result)
            else:
                text = str(search_result)

            if not text or "does not contain" in text.lower():
                continue

            sentences = [s.strip() for s in text.replace("\n", ". ").split(". ") if len(s.strip()) > 15]
            prev_id = None
            for sentence in sentences[:6]:
                node_id = f"{node_type}_{abs(hash(sentence)) % 100000}"
                if node_id not in seen:
                    seen.add(node_id)
                    nodes.append({"id": node_id, "type": node_type, "label": sentence[:45], "data": {}})
                    if prev_id:
                        edges.append({"id": f"e_{prev_id}_{node_id}", "source": prev_id, "target": node_id, "label": "related_to"})
                prev_id = node_id

        if len(nodes) >= 40:
            break

    return {"nodes": nodes[:50], "edges": edges[:70]}


async def smoke_test() -> bool:
    try:
        async with httpx.AsyncClient(follow_redirects=True) as client:
            resp = await client.post(
                f"{COGNEE_API_BASE}/add",
                headers={"X-Api-Key": COGNEE_API_KEY},
                data={"datasetName": "smoke_test"},
                files={"data": ("smoke.txt", b"smoke test", "text/plain")},
                timeout=10,
            )
            return resp.status_code in (200, 201, 409)
    except Exception as e:
        print(f"Cognee Cloud smoke test failed: {e}")
        return False
