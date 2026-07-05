"""
Ingestion Service — GitHub API → Parser → Normalizer → Memory Engine

Runs as a FastAPI BackgroundTask. Idempotent: safe to re-run on the same project.
"""
import uuid
from datetime import datetime, timezone
from github import Github, GithubException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.repositories.project_repository import ProjectRepository
from app.services import memory_service

settings = get_settings()

# File extensions we parse for content ingestion
INGESTIBLE_EXTENSIONS = {
    ".py", ".js", ".ts", ".tsx", ".jsx",
    ".md", ".txt", ".yaml", ".yml", ".json",
    ".java", ".go", ".rs", ".rb", ".php", ".cs",
    ".html", ".css",
}

# Max file size to ingest (bytes) — skip large generated files
MAX_FILE_SIZE = 100_000  # 100 KB
MAX_CONTENT_CHARS = 2000  # Truncate content to avoid Groq TPM limits


def _parse_repo_url(repo_url: str) -> str:
    """Extract 'owner/repo' from a full GitHub URL."""
    # Handle https://github.com/owner/repo and github.com/owner/repo
    url = repo_url.strip().rstrip("/")
    if "github.com" in url:
        parts = url.split("github.com/")
        if len(parts) == 2:
            return parts[1].removesuffix(".git")
    return url  # assume already in owner/repo format


def _should_skip_path(path: str) -> bool:
    """Skip common noise directories."""
    skip_prefixes = (
        "node_modules/", ".git/", "dist/", "build/", "__pycache__/",
        ".next/", "coverage/", "vendor/", ".venv/", "venv/",
    )
    return any(path.startswith(p) for p in skip_prefixes)


async def run_ingestion(
    project_id: uuid.UUID,
    job_id: uuid.UUID,
    db: AsyncSession,
) -> None:
    """
    Main ingestion pipeline. Called as a BackgroundTask.
    Steps:
      1. Fetch repo file tree + README + PRs/issues from GitHub API
      2. Parse into (node, edge) tuples
      3. Write to Cognee via memory_service
      4. Update job status in Postgres
    """
    repo_repo = ProjectRepository(db)

    try:
        # Mark job as in_progress
        await repo_repo.update_ingestion_job(job_id, "in_progress")
        await repo_repo.update_ingestion_status(project_id, "in_progress")

        project = await repo_repo.get_by_id(project_id)
        if not project or not project.repo_url:
            raise ValueError("Project has no repo_url configured")

        # Set the Cognee dataset ID for this project (project-scoped namespace)
        dataset_id = f"project_{project_id}"
        await repo_repo.set_cognee_dataset_id(project_id, dataset_id)

        repo_slug = _parse_repo_url(project.repo_url)
        from github import Auth
        gh = Github(auth=Auth.Token(settings.github_token)) if settings.github_token else Github()
        repo = gh.get_repo(repo_slug)

        documents: list[dict] = []
        files_processed = 0

        # --- Step 1: README ---
        try:
            readme = repo.get_readme()
            documents.append({
                "type": "Document",
                "id": f"readme_{project_id}",
                "content": f"README for {repo.full_name}:\n\n{readme.decoded_content.decode('utf-8', errors='ignore')}",
            })
        except GithubException:
            pass  # No README — not fatal

        # --- Step 2: File tree + file contents ---
        try:
            contents = repo.get_contents("")
            queue = list(contents) if contents else []
        except GithubException:
            queue = []

        while queue:
            item = queue.pop(0)
            if item.type == "dir":
                if not _should_skip_path(item.path + "/"):
                    try:
                        queue.extend(repo.get_contents(item.path))
                    except GithubException:
                        pass
            elif item.type == "file":
                ext = "." + item.name.rsplit(".", 1)[-1] if "." in item.name else ""
                if ext in INGESTIBLE_EXTENSIONS and item.size < MAX_FILE_SIZE:
                    try:
                        file_content = item.decoded_content.decode("utf-8", errors="ignore")
                        # Truncate large files to stay under Groq TPM limits
                        file_content = file_content[:MAX_CONTENT_CHARS]
                        documents.append({
                            "type": "File",
                            "id": f"file_{item.sha}",
                            "content": (
                                f"File: {item.path}\n"
                                f"Path: {item.path}\n\n"
                                f"{file_content}"
                            ),
                        })
                        files_processed += 1
                    except Exception:
                        pass  # Decode failure — skip file

        # --- Step 3: Open PRs ---
        try:
            pr_count = 0
            for pr in repo.get_pulls(state="all"):
                if pr_count >= 20:
                    break
                documents.append({
                    "type": "PullRequest",
                    "id": f"pr_{pr.number}_{project_id}",
                    "content": (
                        f"Pull Request #{pr.number}: {pr.title}\n"
                        f"State: {pr.state}\n"
                        f"Author: {pr.user.login}\n"
                        f"Body: {pr.body or 'No description'}\n"
                        f"Files changed: {pr.changed_files}\n"
                    ),
                })
                pr_count += 1
        except GithubException:
            pass

        # --- Step 4: Open Issues ---
        try:
            issue_count = 0
            for issue in repo.get_issues(state="open"):
                if issue_count >= 20:
                    break
                documents.append({
                    "type": "Issue",
                    "id": f"issue_{issue.number}_{project_id}",
                    "content": (
                        f"Issue #{issue.number}: {issue.title}\n"
                        f"State: {issue.state}\n"
                        f"Author: {issue.user.login}\n"
                        f"Body: {issue.body or 'No description'}\n"
                    ),
                })
                issue_count += 1
        except GithubException:
            pass

        # --- Step 5: Contributors ---
        try:
            contributors = list(repo.get_contributors())[:10]
            contrib_text = "Project Contributors:\n" + "\n".join(
                f"- {c.login} ({c.contributions} contributions)" for c in contributors
            )
            documents.append({
                "type": "Developer",
                "id": f"contributors_{project_id}",
                "content": contrib_text,
            })
        except GithubException:
            pass

        # --- Step 6: Write everything to Cognee Cloud ---
        # Cognee Cloud handles LLM/embeddings on their side — single call is fine
        await memory_service.write_nodes(str(project_id), documents)

        # --- Step 7: Checkout working copy for the in-app editor ---
        import os, subprocess, shutil
        working_dir = f"/app/working_copies/{project_id}"
        if not os.path.exists(working_dir):
            os.makedirs(working_dir, exist_ok=True)
            try:
                # Clone with depth=1 for speed; use token for private repos
                token = settings.github_token
                clone_url = project.repo_url
                if token and "github.com" in clone_url:
                    clone_url = clone_url.replace(
                        "https://github.com/",
                        f"https://{token}@github.com/"
                    )
                branch = project.repo_default_branch or "main"
                subprocess.run(
                    ["git", "clone", "--depth=1", "--branch", branch, clone_url, working_dir],
                    check=True, capture_output=True, timeout=120
                )
            except Exception as e:
                # Working copy failure is non-fatal — ingestion still succeeds
                shutil.rmtree(working_dir, ignore_errors=True)
                working_dir = None

        if working_dir and os.path.exists(working_dir):
            await repo_repo.set_working_copy_path(project_id, working_dir)

        # --- Step 8: Mark complete ---
        await repo_repo.update_ingestion_job(
            job_id,
            status="completed",
            files_processed=files_processed,
            finished=True,
        )
        await repo_repo.update_ingestion_status(project_id, "completed")

    except Exception as e:
        error_msg = str(e)[:500]
        await repo_repo.update_ingestion_job(
            job_id,
            status="failed",
            error_message=error_msg,
            finished=True,
        )
        await repo_repo.update_ingestion_status(project_id, "failed")
        raise
