"""
AI Coding Agent — with Milestone E memory write-back refinement.

Flow:
  1. Read file from working copy
  2. Smart context windowing (send only relevant section to Groq)
  3. Pull Cognee context for the prompt
  4. Generate edited file via Groq
  5. Write file to disk
  6. Rate ticket progress via Groq
  7. Log agent_action to Postgres
  8. Triviality filter → if significant change, generate normalized summary → write to Cognee
"""
import os
import uuid
import re
from datetime import datetime, timezone
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.core.db import get_db
from app.core.security import get_current_user_id
from app.api.deps import get_user_or_401
from app.repositories.project_repository import ProjectRepository
from app.models.ticket import Ticket, AgentAction
from app.services import memory_service
from app.services.ai_service import get_client, MODEL

router = APIRouter(tags=["agent"])

# ─── Prompts ─────────────────────────────────────────────────────────────────

AGENT_SYSTEM_PROMPT = """You are an expert AI coding assistant embedded in a code editor.
You will be given:
1. FILE CONTEXT — either the full file or a relevant section of it
2. PROJECT CONTEXT from the codebase knowledge graph
3. A TASK/PROMPT describing what the developer wants you to do

Your job:
- If given the FULL FILE: return the complete updated file content
- If given a FILE SECTION (marked with line numbers): return ONLY that section with your changes applied
- Return raw file content only — no markdown code blocks, no explanations, no preamble
- Preserve existing code style, indentation, and patterns
- Make targeted, minimal changes — only what is needed for the task
- If the task is not applicable to this section, return it unchanged

IMPORTANT: Return raw code only. No ``` wrappers. No explanation text."""

PROGRESS_RATING_PROMPT = """Rate the new progress percentage (0-100) for this development ticket.

TICKET DESCRIPTION: {description}
FILE CHANGED: {file_path}
CHANGE MADE: {diff_summary}
CURRENT PROGRESS: {current_progress}%

Consider:
- How much of the ticket description does this change address?
- Is this partial or complete?

Reply with ONLY a single integer 0-100. No explanation."""

MEMORY_SUMMARY_PROMPT = """Write a one-sentence factual summary of a code change for a project knowledge base.

PROJECT: {project_name}
FILE: {file_path}
TICKET: {ticket_title}
DEVELOPER'S INTENT: {prompt}
LINES CHANGED: {lines_delta} (before: {lines_before}, after: {lines_after})

Write a single sentence describing WHAT was changed and WHY, suitable for a knowledge graph.
Example: "Added email format validation to the login form in auth/login.py to prevent invalid submissions."

Do NOT include line counts, percentages, or technical metadata. Just what changed and why.
Reply with the single sentence only."""


# ─── Context windowing ────────────────────────────────────────────────────────

def _extract_context_window(content: str, prompt: str, max_chars: int = 6000) -> tuple[str, int, int]:
    lines = content.splitlines(keepends=True)
    total_lines = len(lines)
    if len(content) <= max_chars:
        return content, 0, total_lines
    avg = max(1, len(content) // max(1, total_lines))
    max_lines = max_chars // avg
    p = prompt.lower()
    if any(w in p for w in ["top", "beginning", "start", "header", "import", "first"]):
        end = min(max_lines, total_lines)
        return "".join(lines[:end]), 0, end
    if any(w in p for w in ["bottom", "end", "last", "footer", "append"]):
        start = max(0, total_lines - max_lines)
        return "".join(lines[start:]), start, total_lines
    end = min(max_lines, total_lines)
    return "".join(lines[:end]), 0, end


def _apply_section(original: str, updated_section: str, start: int, end: int) -> str:
    lines = original.splitlines(keepends=True)
    new_lines = updated_section.splitlines(keepends=True)
    return "".join(lines[:start] + new_lines + lines[end:])


# ─── Triviality filter ────────────────────────────────────────────────────────

# Patterns that indicate real logic changes
_LOGIC_PATTERNS = re.compile(
    r"\b(def |function |class |import |from |require\(|export |async |await |"
    r"if |else |elif |for |while |try |catch |except |raise |throw |"
    r"return |yield |const |let |var |=>|->)\b",
    re.MULTILINE,
)

# Patterns that indicate only comments/whitespace changed
_COMMENT_ONLY = re.compile(r"^[+\-]\s*(#|//|/\*|\*)", re.MULTILINE)


def _is_significant_change(original: str, updated: str, min_line_delta: int = 2) -> bool:
    """
    Returns True if the diff represents a real, non-trivial code change.
    Heuristics:
    - Line count delta must be >= min_line_delta OR content must contain logic patterns
    - Must not be purely whitespace/comment changes
    """
    orig_lines = original.splitlines()
    new_lines = updated.splitlines()
    line_delta = abs(len(new_lines) - len(orig_lines))

    # Build a simple unified diff (added/removed lines)
    orig_set = set(l.strip() for l in orig_lines)
    new_set = set(l.strip() for l in new_lines)
    added = [l for l in new_lines if l.strip() and l.strip() not in orig_set]
    removed = [l for l in orig_lines if l.strip() and l.strip() not in new_set]
    changed_lines = "\n".join(f"+ {l}" for l in added) + "\n" + "\n".join(f"- {l}" for l in removed)

    # No real change
    if not added and not removed:
        return False

    # Only whitespace changed
    if original.replace(" ", "").replace("\n", "") == updated.replace(" ", "").replace("\n", ""):
        return False

    # Only comments changed — check if ALL changed lines are comment lines
    non_comment_changes = [
        l for l in (added + removed)
        if l.strip() and not l.strip().startswith(("#", "//", "/*", "*", "'''", '"""'))
    ]
    if not non_comment_changes and line_delta < min_line_delta:
        return False

    # Must have either enough line delta OR contain logic patterns
    has_logic = bool(_LOGIC_PATTERNS.search(changed_lines))
    return line_delta >= min_line_delta or has_logic


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _get_working_copy(project) -> str:
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not project.working_copy_path or not os.path.exists(project.working_copy_path):
        raise HTTPException(status_code=400, detail="Working copy not available. Run ingestion first.")
    return project.working_copy_path


def _safe_path(working_copy: str, file_path: str) -> str:
    safe = os.path.normpath(os.path.join(working_copy, file_path))
    if not safe.startswith(os.path.realpath(working_copy)):
        raise HTTPException(status_code=403, detail="Path traversal not allowed")
    return safe


def _rate_progress(ticket_description: str, file_path: str, diff_summary: str, current: int) -> int:
    try:
        completion = get_client().chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": PROGRESS_RATING_PROMPT.format(
                description=ticket_description[:400],
                file_path=file_path,
                diff_summary=diff_summary[:200],
                current_progress=current,
            )}],
            temperature=0,
            max_completion_tokens=10,
            stream=False,
        )
        raw = completion.choices[0].message.content.strip()
        value = int("".join(c for c in raw if c.isdigit())[:3])
        return max(current, min(100, value))
    except Exception:
        return min(100, current + 15)


def _generate_memory_summary(
    project_name: str,
    file_path: str,
    prompt: str,
    ticket_title: str,
    lines_before: int,
    lines_after: int,
) -> str:
    """Generate a clean, normalized one-sentence summary for Cognee."""
    try:
        completion = get_client().chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": MEMORY_SUMMARY_PROMPT.format(
                project_name=project_name,
                file_path=file_path,
                ticket_title=ticket_title or "no ticket",
                prompt=prompt[:200],
                lines_delta=abs(lines_after - lines_before),
                lines_before=lines_before,
                lines_after=lines_after,
            )}],
            temperature=0.3,
            max_completion_tokens=80,
            stream=False,
        )
        return completion.choices[0].message.content.strip()
    except Exception:
        # Fallback template if Groq fails
        return (
            f"Modified {file_path} in {project_name}: {prompt[:100]}."
            + (f" Related to ticket: {ticket_title}." if ticket_title else "")
        )


# ─── API ──────────────────────────────────────────────────────────────────────

class AgentGenerateRequest(BaseModel):
    prompt: str
    file_path: str
    ticket_id: uuid.UUID | None = None


class AgentGenerateResponse(BaseModel):
    updated_content: str
    file_path: str
    diff_summary: str
    action_id: uuid.UUID
    ticket_progress: int | None = None
    written_to_memory: bool = False


@router.post("/projects/{project_id}/agent/generate", response_model=AgentGenerateResponse)
async def agent_generate(
    project_id: uuid.UUID,
    body: AgentGenerateRequest,
    user_auth_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    user = await get_user_or_401(user_auth_id, db)
    repo = ProjectRepository(db)
    project = await repo.get_by_id(project_id)
    working_copy = _get_working_copy(project)
    abs_path = _safe_path(working_copy, body.file_path)

    if not os.path.isfile(abs_path):
        raise HTTPException(status_code=404, detail=f"File not found: {body.file_path}")

    # Read current file
    try:
        with open(abs_path, "r", encoding="utf-8", errors="replace") as f:
            original_content = f.read()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cannot read file: {e}")

    # Smart context window
    section_content, start_line, end_line = _extract_context_window(
        original_content, body.prompt, max_chars=6000
    )
    is_partial = start_line > 0 or end_line < len(original_content.splitlines())

    # Pull Cognee context (3 snippets — keep prompt short)
    memory_results = await memory_service.search(
        project_id=str(project_id),
        query=f"{body.prompt} {body.file_path}",
        limit=3,
    )
    context_text = "\n\n".join(f"[Context] {r['snippet']}" for r in memory_results) \
                   or "No additional project context available."

    # Build file block
    if is_partial:
        file_block = (
            f"FILE SECTION (lines {start_line+1}–{end_line} of "
            f"{len(original_content.splitlines())} total): {body.file_path}\n"
            f"{'─'*60}\n{section_content}\n{'─'*60}"
        )
    else:
        file_block = f"FULL FILE: {body.file_path}\n{'─'*60}\n{section_content}\n{'─'*60}"

    # LLM call — generate edited file
    try:
        completion = get_client().chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": AGENT_SYSTEM_PROMPT},
                {"role": "user", "content": f"PROJECT CONTEXT:\n{context_text}\n\n{file_block}\n\nTASK: {body.prompt}"},
            ],
            temperature=0.3,
            max_completion_tokens=4096,
            stream=False,
        )
        updated_section = completion.choices[0].message.content or section_content
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM call failed: {str(e)}")

    # Stitch section back if partial
    updated_content = _apply_section(original_content, updated_section, start_line, end_line) \
                      if is_partial else updated_section

    # Write to disk
    try:
        with open(abs_path, "w", encoding="utf-8") as f:
            f.write(updated_content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cannot write file: {e}")

    # Diff summary
    orig_lines = len(original_content.splitlines())
    new_lines = len(updated_content.splitlines())
    section_note = f" (lines {start_line+1}–{end_line})" if is_partial else ""
    diff_summary = (
        f"Modified {body.file_path}{section_note}: {orig_lines}→{new_lines} lines. "
        f"Task: {body.prompt[:100]}"
    )

    # Ticket progress
    ticket_progress = None
    ticket_obj = None
    ticket_title = ""
    if body.ticket_id:
        result = await db.execute(select(Ticket).where(Ticket.id == body.ticket_id))
        ticket_obj = result.scalar_one_or_none()
        if ticket_obj:
            ticket_title = ticket_obj.title
            new_progress = _rate_progress(
                ticket_description=ticket_obj.description or ticket_obj.title,
                file_path=body.file_path,
                diff_summary=diff_summary,
                current=ticket_obj.progress,
            )
            ticket_obj.progress = new_progress
            ticket_obj.updated_at = datetime.now(timezone.utc)
            ticket_progress = new_progress

    # ── Milestone E: Triviality filter + normalized memory write-back ──────────
    written_to_memory = False
    memory_summary = None

    if _is_significant_change(original_content, updated_content):
        # Generate a clean, normalized summary (one extra Groq call)
        memory_summary = _generate_memory_summary(
            project_name=project.name,
            file_path=body.file_path,
            prompt=body.prompt,
            ticket_title=ticket_title,
            lines_before=orig_lines,
            lines_after=new_lines,
        )
        written_to_memory = True
    # else: trivial change — skip Cognee entirely

    # Log agent_action to Postgres (always — even trivial actions)
    action = AgentAction(
        ticket_id=body.ticket_id,
        project_id=project_id,
        employee_id=user.id,
        prompt=body.prompt,
        file_path=body.file_path,
        diff_summary=diff_summary,
        progress_before=ticket_obj.progress if ticket_obj else None,
        progress_after=ticket_progress,
        written_to_memory=written_to_memory,
        created_at=datetime.now(timezone.utc),
    )
    db.add(action)
    await db.commit()
    await db.refresh(action)

    # Fire-and-forget write to Cognee — only if significant, only the normalized summary
    if written_to_memory and memory_summary:
        import asyncio
        payload = (
            f"[PROJECT CHANGE — {project.name}]\n"
            f"File: {body.file_path}\n"
            f"Change: {memory_summary}\n"
            + (f"Ticket: {ticket_title}\n" if ticket_title else "")
            + f"Timestamp: {datetime.now(timezone.utc).isoformat()}"
        )
        asyncio.create_task(memory_service.write_text(str(project_id), payload))

    return AgentGenerateResponse(
        updated_content=updated_content,
        file_path=body.file_path,
        diff_summary=diff_summary,
        action_id=action.id,
        ticket_progress=ticket_progress,
        written_to_memory=written_to_memory,
    )
