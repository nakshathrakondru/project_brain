"""
Editor API — serves file tree and file contents from the project's working copy.
The working copy is a shallow Git clone of the repo, checked out at ingestion time.
"""
import os
import uuid
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.core.db import get_db
from app.core.security import get_current_user_id
from app.repositories.project_repository import ProjectRepository

router = APIRouter(tags=["editor"])

# Directories to skip in file tree
SKIP_DIRS = {
    ".git", "node_modules", "__pycache__", ".next", "dist",
    "build", "coverage", ".venv", "venv", ".mypy_cache",
}

# Extensions to show in file tree
SHOW_EXTENSIONS = {
    ".py", ".js", ".ts", ".tsx", ".jsx", ".mjs", ".cjs",
    ".json", ".yaml", ".yml", ".toml", ".ini", ".cfg",
    ".md", ".txt", ".env", ".example",
    ".html", ".css", ".scss", ".sass",
    ".java", ".go", ".rs", ".rb", ".php", ".cs",
    ".sh", ".bash", ".zsh",
    ".sql", ".graphql", ".proto",
    ".gitignore", ".dockerignore", "Dockerfile", "Makefile",
}


def _is_visible(name: str) -> bool:
    if name in SKIP_DIRS:
        return False
    if name.startswith(".") and name not in {".env", ".gitignore", ".dockerignore"}:
        return False
    ext = Path(name).suffix.lower()
    # Show files with known extensions OR no extension (like Makefile, Dockerfile)
    return ext in SHOW_EXTENSIONS or (not ext and name[0].isupper())


def _build_tree(base_path: str, rel_path: str = "") -> list[dict]:
    """Recursively build a file tree structure."""
    current = os.path.join(base_path, rel_path) if rel_path else base_path
    items = []

    try:
        entries = sorted(os.scandir(current), key=lambda e: (not e.is_dir(), e.name.lower()))
    except PermissionError:
        return []

    for entry in entries:
        if entry.name in SKIP_DIRS:
            continue
        if entry.name.startswith(".") and entry.name not in {".env", ".gitignore", ".dockerignore"}:
            continue

        entry_rel = os.path.join(rel_path, entry.name) if rel_path else entry.name

        if entry.is_dir(follow_symlinks=False):
            children = _build_tree(base_path, entry_rel)
            if children:  # Only include dirs that have visible children
                items.append({
                    "name": entry.name,
                    "path": entry_rel,
                    "type": "directory",
                    "children": children,
                })
        elif entry.is_file():
            ext = Path(entry.name).suffix.lower()
            if ext in SHOW_EXTENSIONS or (not ext and entry.name[0].isupper()):
                items.append({
                    "name": entry.name,
                    "path": entry_rel,
                    "type": "file",
                    "size": entry.stat().st_size,
                })

    return items


def _get_working_copy(project: any) -> str:
    """Get the working copy path, raise 404 if not available."""
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not project.working_copy_path or not os.path.exists(project.working_copy_path):
        raise HTTPException(
            status_code=404,
            detail="Working copy not available. Re-run ingestion to checkout the repository."
        )
    return project.working_copy_path


def _safe_path(working_copy: str, file_path: str) -> str:
    """Resolve a relative path within the working copy, preventing path traversal."""
    # Normalize and prevent directory traversal
    safe = os.path.normpath(os.path.join(working_copy, file_path))
    if not safe.startswith(os.path.realpath(working_copy)):
        raise HTTPException(status_code=403, detail="Path traversal not allowed")
    return safe


@router.get("/projects/{project_id}/editor/tree")
async def get_file_tree(
    project_id: uuid.UUID,
    user_auth_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Returns the full file tree of the project's working copy."""
    repo = ProjectRepository(db)
    project = await repo.get_by_id(project_id)
    working_copy = _get_working_copy(project)
    tree = _build_tree(working_copy)
    return {"project_id": project_id, "tree": tree}


@router.get("/projects/{project_id}/editor/file")
async def read_file(
    project_id: uuid.UUID,
    path: str,
    user_auth_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Read the contents of a file from the working copy."""
    repo = ProjectRepository(db)
    project = await repo.get_by_id(project_id)
    working_copy = _get_working_copy(project)
    abs_path = _safe_path(working_copy, path)

    if not os.path.isfile(abs_path):
        raise HTTPException(status_code=404, detail=f"File not found: {path}")

    # Check file size before reading (max 500KB for editor)
    size = os.path.getsize(abs_path)
    if size > 500_000:
        raise HTTPException(status_code=413, detail="File too large to display in editor (>500KB)")

    try:
        with open(abs_path, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not read file: {str(e)}")

    return {
        "path": path,
        "content": content,
        "size": size,
        "language": _detect_language(path),
    }


class FileSaveRequest(BaseModel):
    content: str


@router.put("/projects/{project_id}/editor/file")
async def save_file(
    project_id: uuid.UUID,
    path: str,
    body: FileSaveRequest,
    user_auth_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Write updated content to a file in the working copy."""
    repo = ProjectRepository(db)
    project = await repo.get_by_id(project_id)
    working_copy = _get_working_copy(project)
    abs_path = _safe_path(working_copy, path)

    if not os.path.isfile(abs_path):
        raise HTTPException(status_code=404, detail=f"File not found: {path}")

    try:
        with open(abs_path, "w", encoding="utf-8") as f:
            f.write(body.content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not write file: {str(e)}")

    return {"path": path, "saved": True, "size": len(body.content.encode("utf-8"))}


def _detect_language(path: str) -> str:
    """Map file extension to Monaco editor language ID."""
    ext = Path(path).suffix.lower()
    mapping = {
        ".py": "python", ".js": "javascript", ".mjs": "javascript", ".cjs": "javascript",
        ".ts": "typescript", ".tsx": "typescriptreact", ".jsx": "javascriptreact",
        ".json": "json", ".yaml": "yaml", ".yml": "yaml", ".toml": "toml",
        ".md": "markdown", ".html": "html", ".css": "css", ".scss": "scss",
        ".sh": "shell", ".bash": "shell", ".zsh": "shell",
        ".sql": "sql", ".graphql": "graphql", ".proto": "protobuf",
        ".java": "java", ".go": "go", ".rs": "rust", ".rb": "ruby",
        ".php": "php", ".cs": "csharp", ".txt": "plaintext",
        ".env": "shell", ".gitignore": "plaintext", ".dockerignore": "plaintext",
        "": "plaintext",
    }
    # Handle special filenames
    name = Path(path).name
    if name in {"Dockerfile", "Makefile"}:
        return "dockerfile" if name == "Dockerfile" else "makefile"
    return mapping.get(ext, "plaintext")
