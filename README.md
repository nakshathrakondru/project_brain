# Mycelium

> Shared AI memory for dev teams. One codebase ingested. One memory. Every developer's AI stays grounded.

**Mycelium** is a team-wide knowledge layer that sits between your GitHub repo and every developer's AI coding session. It ingests your codebase into a knowledge graph (powered by Cognee), then gives managers and employees a shared workspace where AI-generated code edits, Q&A, and ticket progress all flow back into the same growing memory.

---

## The Problem It Solves

Two developers. Two AI sessions. No shared memory.

- Priya adds email validation to `auth/login.py`
- An hour later, Dev works on `checkout/payment.py` — their AI has no idea about Priya's change
- Result: duplicated patterns, inconsistent conventions, context lost every time a session ends

**Mycelium fixes this.** Every agent edit, every AI question answered, every PR merged — it all writes back into one shared knowledge graph. The next developer's AI starts already knowing what happened.

---

## Features

| Feature | Description |
|---------|-------------|
| **GitHub Ingestion** | Ingests files, PRs, issues, and contributors from any GitHub repo into a Cognee knowledge graph |
| **AI Tech Lead** | Ask natural language questions about the codebase, grounded in real project history |
| **AI Code Agent** | In-browser code editor with an AI agent that edits files directly and writes changes back to shared memory |
| **Knowledge Graph** | Interactive React Flow visualization of how files, modules, PRs, and developers connect |
| **Semantic Search** | Search across the project's knowledge graph with plain English |
| **Tickets + Progress** | Manager creates tickets, assigns to employees; progress auto-updates as the AI agent works |
| **Manager Dashboard** | Real-time per-employee, per-ticket progress view — no manual status updates needed |
| **Developer Onboarding** | AI-generated onboarding guide for new developers joining a project |
| **Timeline** | Chronological feed of all project memory events |
| **Persistent Chat Sessions** | AI Tech Lead conversations are saved per-session (ChatGPT style) |
| **Agent Sessions** | Code editor agent has Kiro-style session tabs that persist across refreshes |

---

## Roles

| Role | Capabilities |
|------|-------------|
| **Manager** | Create organizations, create projects (via GitHub link), assign projects to employees, create and assign tickets, view manager dashboard |
| **Employee** | See assigned projects and tickets, open the code editor, use the AI agent, view own progress |

First user to sign up = Manager. Invites default to Employee.

---

## Demo Accounts

Sign in at http://localhost:3000/sign-in

| Role | Username | Password |
|------|----------|----------|
| Manager | `manager` | `manager@235` |
| Employee 1 | `employee1` | `employee@235` |
| Employee 2 | `employee2` | `employee@235` |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS, Radix UI |
| Code Editor | Monaco Editor (`@monaco-editor/react`) |
| Graph Visualization | React Flow + dagre auto-layout |
| Auth | Clerk (OAuth via Google, username/password) |
| Backend API | FastAPI (Python 3.11), async, uvicorn with hot-reload |
| Database | PostgreSQL 16 with pgvector |
| ORM + Migrations | SQLAlchemy 2.0 (async) + Alembic |
| Knowledge Graph | Cognee Cloud (managed AWS tenant) |
| LLM | Groq — `llama-3.1-8b-instant` / `llama-3.3-70b-versatile` |
| GitHub Integration | PyGithub (ingestion + working copy checkout) |
| Infrastructure | Docker Compose (Postgres + API + Web) |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Next.js Frontend                   │
│  (Editor, Tickets, Chat, Dashboard, Graph, Nav)      │
└──────────────────────┬──────────────────────────────┘
                       │ REST / JSON (polling)
┌──────────────────────▼──────────────────────────────┐
│                   FastAPI Backend                    │
│  ┌─────────────────────────────────────────────┐    │
│  │  Routers: auth, projects, tickets, editor,  │    │
│  │           agent, memory, sessions, dashboard │    │
│  └──────────────────┬──────────────────────────┘    │
│  ┌──────────────────▼──────────────────────────┐    │
│  │  Services: ai_service, memory_service,       │    │
│  │            ingestion_service, agent          │    │
│  └──────────────────┬──────────────────────────┘    │
│  ┌──────────────────▼──────────────────────────┐    │
│  │  Repository Layer (SQLAlchemy + Postgres)    │    │
│  └─────────────────────────────────────────────┘    │
└──────────┬──────────────────────┬───────────────────┘
           │                      │
    ┌──────▼──────┐      ┌────────▼────────────┐
    │  PostgreSQL  │      │    Cognee Cloud      │
    │  (identity,  │      │  (knowledge graph +  │
    │  projects,   │      │   vector memory,     │
    │  tickets,    │      │   AWS tenant)        │
    │  sessions)   │      └─────────────────────┘
    └─────────────┘
           │
    ┌──────▼──────────────────────┐
    │  Ingestion Worker           │
    │  GitHub API → files, PRs,   │
    │  issues → Cognee Cloud      │
    │  + git clone → working copy │
    └─────────────────────────────┘
```

---

## Ingestion Pipeline

```
User clicks "Start Ingestion"
        │
        ▼
POST /ingest  →  FastAPI creates IngestionJob (queued)
                 Returns 202 immediately
        │
        ▼ BackgroundTask: run_ingestion()
        │
        ├─ Step 1: GitHub README
        ├─ Step 2: File tree BFS (skips node_modules, .git, dist etc.)
        │          Extensions: .py .js .ts .tsx .jsx .md .yaml .json etc.
        │          Max file size: 100KB, content truncated at 2000 chars
        ├─ Step 3: PRs (max 20, all states)
        ├─ Step 4: Issues (max 20, open)
        ├─ Step 5: Contributors (top 10)
        │
        ├─ Step 6: POST all docs to Cognee Cloud /api/add
        │          POST /api/cognify → builds knowledge graph
        │
        ├─ Step 7: git clone --depth=1 → /app/working_copies/{project_id}
        │          (enables in-browser code editor)
        │
        └─ Step 8: Mark job completed in Postgres
```

**Token consumption estimate (Cognee Cloud):**

| Repo Size | Files | Estimated Tokens | Cost (~$2.50/1M) |
|-----------|-------|-----------------|-----------------|
| Small (<20 files) | ~15–20 | ~80K–160K | ~$0.20–$0.40 |
| Medium (50–100 files) | ~50–80 | ~320K–640K | ~$0.80–$1.60 |
| Large (200+ files) | ~150–200 | ~1M–1.6M | ~$2.50–$4.00 |

---

## AI Agent — How It Works

```
Employee types prompt in Code Editor
        │
        ▼
POST /projects/{id}/agent/generate
        │
        ├─ Read file from working copy
        ├─ Smart context windowing:
        │   • "add at top" → sends first N lines only
        │   • "append" → sends last N lines only
        │   • default → sends first N lines (max ~6000 chars)
        │
        ├─ Search Cognee for 3 relevant context snippets
        │
        ├─ Call Groq llama-3.1-8b-instant:
        │   System: "Return raw file content only"
        │   User: context + file section + prompt
        │
        ├─ Stitch edited section back into full file
        ├─ Write to working copy on disk
        │
        ├─ LLM-rate ticket progress (0–100, never goes down)
        │
        ├─ Log AgentAction to Postgres
        │
        └─ Milestone E filter: if change is significant
           (≥2 line delta OR contains real logic keywords)
           → generate 1-sentence normalized summary
           → write to Cognee as a memory event
           (trivial changes like whitespace/comments are skipped)
```

---

## Database Schema

```
users               — Clerk-linked user accounts
organizations       — Workspaces
organization_members — user ↔ org with role (manager|employee)
projects            — GitHub repo + ingestion status + working_copy_path
project_assignments — manager assigns employee to project
project_members     — legacy (kept for backward compat)
ingestion_jobs      — ingestion run history
tickets             — tasks with progress 0–100, assigned_to/assigned_by
agent_actions       — every AI agent edit, linked to ticket + session
agent_sessions      — named agent chat sessions (Kiro-style tabs)
agent_messages      — messages within an agent session
chat_sessions       — named AI Tech Lead conversations
ai_conversations    — Q&A pairs linked to chat sessions
tasks               — legacy task board (kept for backward compat)
```

**Migrations:** 4 Alembic migrations (0001–0004)

---

## Running Locally

### Prerequisites

- Docker Desktop
- Clerk account — https://clerk.com (enable Username sign-in)
- Groq API key — https://console.groq.com (free)
- Cognee Cloud API key + tenant URL — https://platform.cognee.ai (free)
- GitHub personal access token — https://github.com/settings/tokens

### Setup

```bash
# 1. Clone the repo
git clone <repo-url>
cd project_brain

# 2. Create infra/.env
cp apps/api/.env.example infra/.env
# Fill in: CLERK_SECRET_KEY, CLERK_PUBLISHABLE_KEY, GROQ_API_KEY,
#          COGNEE_API_KEY (not used directly — see memory_service.py),
#          GITHUB_TOKEN, NEXT_PUBLIC_DEFAULT_ORG_ID

# 3. Start everything
cd infra
docker compose up -d --build

# 4. Run migrations
docker compose exec api alembic upgrade head

# 5. Seed demo org and users
docker compose exec api python scripts/seed_demo.py
```

### Access

| Service | URL |
|---------|-----|
| Web UI | http://localhost:3000 |
| API | http://localhost:8000 |
| API Docs | http://localhost:8000/docs |
| Health | http://localhost:8000/health |

### Stop

```bash
docker compose down
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `CLERK_SECRET_KEY` | ✅ | Clerk backend secret key |
| `CLERK_PUBLISHABLE_KEY` | ✅ | Clerk frontend publishable key |
| `GROQ_API_KEY` | ✅ | Groq LLM API key (free tier works) |
| `GITHUB_TOKEN` | ✅ | GitHub PAT with `repo` scope |
| `NEXT_PUBLIC_DEFAULT_ORG_ID` | ✅ | UUID of the default organization |
| `OPENAI_API_KEY` | ❌ | Optional (not used — Cognee Cloud handles embeddings) |
| `DATABASE_URL` | auto | Set by docker-compose from Postgres credentials |
| `COGNEE_API_KEY` | hardcoded | Set in `memory_service.py` directly |

---

## API Endpoints Summary

```
Auth
  POST /api/v1/auth/me          — Upsert user from Clerk JWT (auto-joins default org)
  GET  /api/v1/auth/me          — Get current user

Organizations
  POST /api/v1/organizations                    — Create org
  GET  /api/v1/organizations/{id}               — Get org
  POST /api/v1/organizations/{id}/invite        — Invite member
  GET  /api/v1/organizations/{id}/members       — List members with roles

Projects
  POST   /api/v1/organizations/{id}/projects          — Create project
  GET    /api/v1/organizations/{id}/projects          — List projects
  PATCH  /api/v1/organizations/{id}/projects/{id}     — Update project
  DELETE /api/v1/organizations/{id}/projects/{id}     — Delete project
  POST   /api/v1/projects/{id}/assign                 — Assign employee
  DELETE /api/v1/projects/{id}/assign/{employee_id}   — Unassign employee
  GET    /api/v1/projects/{id}/assignments            — List assignments
  GET    /api/v1/users/me/assignments                 — My assigned projects

Ingestion
  POST /api/v1/organizations/{org_id}/projects/{id}/ingest         — Start ingestion
  GET  /api/v1/organizations/{org_id}/projects/{id}/ingest/status  — Status

Tickets
  POST   /api/v1/projects/{id}/tickets           — Create ticket
  GET    /api/v1/projects/{id}/tickets           — List tickets
  GET    /api/v1/projects/{id}/tickets/mine      — My tickets
  PATCH  /api/v1/projects/{id}/tickets/{id}      — Update ticket
  DELETE /api/v1/projects/{id}/tickets/{id}      — Delete ticket

Memory & AI
  POST /api/v1/projects/{id}/ask        — AI Tech Lead Q&A
  GET  /api/v1/projects/{id}/search     — Semantic search
  GET  /api/v1/projects/{id}/graph      — Knowledge graph data
  GET  /api/v1/projects/{id}/timeline   — Timeline events
  GET  /api/v1/projects/{id}/dashboard  — Legacy metrics
  GET  /api/v1/projects/{id}/manager-dashboard — Manager dashboard (live, polled)
  GET  /api/v1/projects/{id}/onboarding — Onboarding guide

Code Editor
  GET /api/v1/projects/{id}/editor/tree         — File tree
  GET /api/v1/projects/{id}/editor/file?path=   — Read file
  PUT /api/v1/projects/{id}/editor/file?path=   — Save file

AI Agent
  POST /api/v1/projects/{id}/agent/generate     — Generate + apply code edit

Sessions
  GET  /api/v1/projects/{id}/chat-sessions               — List AI Tech Lead sessions
  POST /api/v1/projects/{id}/chat-sessions               — Create session
  GET  /api/v1/projects/{id}/chat-sessions/{id}/messages — Chat history
  GET  /api/v1/projects/{id}/agent-sessions              — List agent sessions
  POST /api/v1/projects/{id}/agent-sessions              — Create session
  GET  /api/v1/projects/{id}/agent-sessions/{id}/messages — Agent history
  POST /api/v1/projects/{id}/agent-sessions/{id}/messages — Save message
```

---

## Project Structure

```
project_brain/
├── apps/
│   ├── api/                    # FastAPI backend
│   │   ├── app/
│   │   │   ├── api/v1/         # Route handlers
│   │   │   ├── core/           # Config, DB, security (JWT)
│   │   │   ├── models/         # SQLAlchemy models
│   │   │   ├── repositories/   # DB access layer
│   │   │   ├── schemas/        # Pydantic schemas
│   │   │   └── services/       # Business logic
│   │   │       ├── ai_service.py       # Groq LLM calls
│   │   │       ├── memory_service.py   # Cognee Cloud adapter
│   │   │       └── ingestion_service.py
│   │   ├── alembic/            # DB migrations
│   │   └── scripts/            # Seed scripts
│   └── web/                    # Next.js frontend
│       ├── app/                # App Router pages
│       │   ├── (auth)/         # Sign-in / sign-up
│       │   ├── dashboard/      # Projects dashboard
│       │   └── projects/[id]/  # All project pages
│       │       ├── ask/        # AI Tech Lead
│       │       ├── editor/     # Code editor + agent
│       │       ├── tickets/    # Ticket board
│       │       ├── graph/      # Knowledge graph
│       │       ├── dashboard/  # Manager dashboard
│       │       ├── team/       # Assign employees
│       │       └── settings/   # Project settings
│       └── components/
│           ├── GraphBackground.tsx   # Animated landing background
│           ├── LandingPanels.tsx     # Hero demo panels
│           ├── ProjectNav.tsx        # Sidebar + focused mode
│           ├── SecondaryProof.tsx    # Tabbed graph/chat panels
│           └── DeleteProjectButton.tsx
└── infra/
    ├── docker-compose.yml
    ├── .env                    # Your secrets (not committed)
    └── Dockerfile.api / .web
```

---

## Known Limitations (Hackathon Scope)

| Limitation | Notes |
|-----------|-------|
| Agent edits don't push to GitHub | Working copy only — by design for demo |
| Single-file agent edits | Multi-file refactors deferred |
| Cognee graph visualization is synthetic | Built from search result sentences (no raw graph node export API) |
| No real-time multi-user collab | One editor session at a time |
| Groq free tier rate limits | 6000 TPM on llama-3.1-8b-instant |

---

## Built With

- [Cognee](https://cognee.ai) — the memory engine for AI agents (knowledge graph + vector memory)
- [Groq](https://groq.com) — ultra-fast LLM inference
- [Next.js](https://nextjs.org) — React framework
- [FastAPI](https://fastapi.tiangolo.com) — Python async API
- [Clerk](https://clerk.com) — authentication
- [React Flow](https://reactflow.dev) — graph visualization
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) — in-browser code editor

---

*Mycelium — like the fungal network that connects trees in a forest, sharing nutrients invisibly beneath the surface. Your team's AI, connected.*
