"""
AI Reasoning Layer — Groq SDK with streaming.

Uses the native groq package. All three features (ask, generate_tasks,
generate_onboarding) stream tokens and collect them into a final string.
Model: llama-3.1-8b-instant
"""
import asyncio
import json
import uuid
from datetime import datetime, timezone
from groq import Groq
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.services import memory_service
from app.models.conversation import AIConversation

settings = get_settings()

_groq_client: Groq | None = None


def get_client() -> Groq:
    global _groq_client
    if _groq_client is None:
        _groq_client = Groq(api_key=settings.groq_api_key)
    return _groq_client


MODEL = "llama-3.1-8b-instant"


def _stream(messages: list[dict], temperature: float = 1, max_tokens: int = 1024) -> str:
    """
    Run a streaming Groq completion and collect all chunks into a single string.
    Matches the pattern: stream=True, iterate chunks, read delta.content.
    """
    completion = get_client().chat.completions.create(
        model=MODEL,
        messages=messages,
        temperature=temperature,
        max_completion_tokens=max_tokens,
        top_p=1,
        stream=True,
        stop=None,
    )
    result = ""
    for chunk in completion:
        result += chunk.choices[0].delta.content or ""
    return result


GROUNDING_SYSTEM_PROMPT = """You are the AI Tech Lead for a software project.
Answer questions using ONLY the context provided.
Do not hallucinate details not in the context.
If the context is insufficient, say so clearly.
Be concise and reference actual files, decisions, or PRs from the context."""

TASK_GENERATION_SYSTEM_PROMPT = """You are a software architect generating a structured task list.
Given a feature description and project context, produce a JSON object with a "tasks" key containing an array.
Each task must have: title, description, category (one of: backend, frontend, database, testing, deployment).
Generate 5-10 specific, actionable tasks.
Return ONLY valid JSON: {"tasks": [{"title": "...", "description": "...", "category": "..."}]}"""

ONBOARDING_SYSTEM_PROMPT = """You are generating an onboarding guide for a new developer joining a project.
Using the project context provided, write a guide covering:
1. Project overview and purpose
2. Architecture and key modules
3. Key files and where to start reading
4. Important decisions and why they were made
5. Common workflows (run, test, deploy)
6. Who to ask about what
Be friendly, specific, and reference actual files and components."""


async def ask(
    project_id: str,
    question: str,
    user_id: uuid.UUID,
    db: AsyncSession,
) -> dict:
    """
    AI Tech Lead: search memory for context, stream a grounded answer from Groq,
    write the Q&A back into Cognee, persist to Postgres.
    """
    # 1. Pull relevant context from Cognee
    memory_results = await memory_service.search(
        project_id=project_id,
        query=question,
        search_type="insights",
        limit=8,
    )

    context_text = "\n\n---\n\n".join(
        f"[{r['node_type']}] {r['title']}\n{r['snippet']}"
        for r in memory_results
    ) or "No relevant context found in the project's knowledge graph."

    # 2. Stream answer from Groq
    answer = _stream(
        messages=[
            {"role": "system", "content": GROUNDING_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": f"PROJECT CONTEXT:\n{context_text}\n\nQUESTION: {question}",
            },
        ],
        temperature=1,
        max_tokens=1024,
    )

    # 3. Write Q&A back into Cognee memory (makes the graph richer over time)
    await memory_service.write_text(
        project_id=project_id,
        text=(
            f"Conversation — Question: {question}\n"
            f"Answer: {answer}\n"
            f"Referenced: {', '.join(r['title'] for r in memory_results)}"
        ),
    )

    # 4. Persist to Postgres
    convo = AIConversation(
        project_id=uuid.UUID(project_id),
        user_id=user_id,
        question=question,
        answer=answer,
        created_at=datetime.now(timezone.utc),
    )
    db.add(convo)
    await db.commit()
    await db.refresh(convo)

    return {
        "answer": answer,
        "sources": memory_results,
        "conversation_id": convo.id,
    }


async def generate_tasks(project_id: str, feature_description: str) -> list[dict]:
    """
    Task Generator: stream a structured JSON task list from Groq,
    grounded in the project's knowledge graph.
    """
    memory_results = await memory_service.search(
        project_id=project_id,
        query=feature_description,
        search_type="insights",
        limit=5,
    )

    context_text = "\n\n".join(
        f"[{r['node_type']}] {r['title']}: {r['snippet']}"
        for r in memory_results
    ) or "Limited project context available."

    raw = _stream(
        messages=[
            {"role": "system", "content": TASK_GENERATION_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"PROJECT CONTEXT:\n{context_text}\n\n"
                    f"FEATURE TO IMPLEMENT: {feature_description}\n\n"
                    f"Return a JSON object with a 'tasks' array."
                ),
            },
        ],
        temperature=1,
        max_tokens=1024,
    )

    try:
        parsed = json.loads(raw)
        if isinstance(parsed, list):
            return parsed
        if isinstance(parsed, dict):
            return next((v for v in parsed.values() if isinstance(v, list)), [])
    except json.JSONDecodeError:
        pass
    return []


async def generate_onboarding(project_id: str) -> str:
    """
    Onboarding Guide: pull broad context from memory in parallel, stream a dev guide from Groq.
    """
    queries = [
        "project architecture overview",
        "key files and modules",
        "important decisions and why",
        "how to run and test the project",
    ]

    search_results = await asyncio.gather(
        *[
            memory_service.search(
                project_id=project_id,
                query=q,
                search_type="summaries",
                limit=3,
            )
            for q in queries
        ]
    )

    all_context: list[str] = [
        f"[{r['node_type']}] {r['title']}: {r['snippet']}"
        for results in search_results
        for r in results
    ]

    context_text = "\n\n".join(all_context) or "Limited project context available."

    return _stream(
        messages=[
            {"role": "system", "content": ONBOARDING_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"PROJECT CONTEXT:\n{context_text}\n\n"
                    f"Generate a comprehensive onboarding guide."
                ),
            },
        ],
        temperature=1,
        max_tokens=1024,
    )
