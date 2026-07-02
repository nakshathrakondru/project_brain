# Project Brain

A knowledge graph service for software projects — structured, queryable memory for everything that happened and why.

## Stack

- **Frontend**: Next.js 14 (App Router), Tailwind CSS, shadcn/ui, React Flow, Clerk Auth
- **Backend**: FastAPI, SQLAlchemy, Alembic, Cognee, OpenAI
- **Databases**: PostgreSQL (application state), Cognee (knowledge graph + vector memory)
- **Infra**: Docker Compose

## Quick Start

```bash
# 1. Copy env files
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

# 2. Fill in your secrets (Clerk, OpenAI, GitHub token)

# 3. Start everything
docker compose -f infra/docker-compose.yml up --build

# 4. Run DB migrations (first time only)
docker compose -f infra/docker-compose.yml exec api alembic upgrade head
```

App will be at http://localhost:3000, API at http://localhost:8000.

## Milestones

- [x] Milestone 0 — Scaffold, auth, DB, Cognee smoke test
- [ ] Milestone 1 — Projects & ingestion skeleton
- [ ] Milestone 2 — AI Tech Lead + Smart Search
- [ ] Milestone 3 — Task Generator + Knowledge Graph View
- [ ] Milestone 4 — Timeline, Onboarding, Dashboard
- [ ] Milestone 5 — Polish & demo prep
