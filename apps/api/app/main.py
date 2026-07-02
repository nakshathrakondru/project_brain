from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.services.memory_service import setup_cognee
from app.api.v1 import auth, organizations, projects, memory, tasks, graph, timeline, dashboard, onboarding

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await setup_cognee()
    print("✓ Cognee configured")
    yield
    # Shutdown (nothing needed for now)


app = FastAPI(
    title="Project Brain API",
    description="Knowledge graph service for software projects",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register all routers under /api/v1
PREFIX = "/api/v1"

app.include_router(auth.router, prefix=PREFIX)
app.include_router(organizations.router, prefix=PREFIX)
app.include_router(projects.router, prefix=PREFIX)
app.include_router(memory.router, prefix=PREFIX)
app.include_router(tasks.router, prefix=PREFIX)
app.include_router(graph.router, prefix=PREFIX)
app.include_router(timeline.router, prefix=PREFIX)
app.include_router(dashboard.router, prefix=PREFIX)
app.include_router(onboarding.router, prefix=PREFIX)


@app.get("/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}


@app.get("/api/v1/cognee/smoke-test")
async def cognee_smoke_test():
    """Dev endpoint: verify Cognee can write and read a test node."""
    from app.services.memory_service import smoke_test
    ok = await smoke_test()
    return {"cognee_ok": ok}
