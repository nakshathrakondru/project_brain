"""
Standalone Cognee smoke test — run this to confirm Cognee v1.x
can write memory and recall it.

Usage:
    cd apps/api
    python scripts/cognee_smoke_test.py
"""
import asyncio
import os
from dotenv import load_dotenv

load_dotenv()

import cognee


async def main():
    print("Configuring Cognee v1.x...")
    cognee.config.set_llm_config({
        "provider": "openai",
        "model": "gpt-4o-mini",
        "api_key": os.getenv("OPENAI_API_KEY"),
    })
    cognee.config.set_embedding_config({
        "provider": "openai",
        "model": "text-embedding-3-small",
        "api_key": os.getenv("OPENAI_API_KEY"),
    })

    print("Writing test node via cognee.remember()...")
    result = await cognee.remember(
        "Project Brain is a knowledge graph service for software projects. "
        "It uses Cognee for semantic memory and FastAPI for the backend.",
        dataset_name="smoke_test",
    )
    print(f"  remember() status: {result.status}")

    print("Querying via cognee.recall()...")
    results = await cognee.recall(
        query_text="knowledge graph software project",
        datasets=["smoke_test"],
        top_k=3,
    )

    if results:
        print(f"✓ Cognee smoke test PASSED — {len(results)} result(s) returned")
        for r in results[:2]:
            text = getattr(r, "text", None) or getattr(r, "answer", str(r))
            print(f"  → [{r.source}] {str(text)[:100]}")
    else:
        print("✗ Cognee smoke test FAILED — no results returned")


if __name__ == "__main__":
    asyncio.run(main())
