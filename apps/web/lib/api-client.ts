/**
 * Typed API client for the Project Brain FastAPI backend.
 * All requests include the Clerk JWT via the Authorization header.
 */
import { auth } from "@clerk/nextjs/server";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const API_PREFIX = `${API_BASE}/api/v1`;

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function getToken(): Promise<string | null> {
  try {
    const { getToken } = auth();
    return await getToken();
  } catch {
    return null;
  }
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null
): Promise<T> {
  const resolvedToken = token ?? (await getToken());

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (resolvedToken) {
    headers["Authorization"] = `Bearer ${resolvedToken}`;
  }

  const res = await fetch(`${API_PREFIX}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      message = body.detail ?? message;
    } catch {}
    throw new ApiError(res.status, message);
  }

  return res.json() as Promise<T>;
}

// ---- Types ----

export interface Project {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  repo_url: string | null;
  repo_default_branch: string | null;
  ingestion_status: "not_started" | "queued" | "in_progress" | "completed" | "failed";
  created_by: string;
  created_at: string;
}

export interface IngestionStatus {
  project_id: string;
  ingestion_status: string;
  latest_job: {
    id: string;
    status: string;
    files_processed: number;
    started_at: string | null;
    finished_at: string | null;
    error_message: string | null;
  } | null;
}

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  category: string | null;
  status: "todo" | "in_progress" | "done";
  source: "ai_generated" | "manual";
  created_at: string;
}

export interface AskResponse {
  answer: string;
  sources: Array<{ node_type: string; title: string; snippet: string }>;
  conversation_id: string;
}

export interface SearchResult {
  node_id: string;
  node_type: string;
  title: string;
  snippet: string;
  score: number | null;
}

export interface GraphData {
  nodes: Array<{ id: string; type: string; label: string; data: Record<string, unknown> }>;
  edges: Array<{ id: string; source: string; target: string; label: string }>;
}

export interface TimelineEvent {
  id: string;
  type: string;
  title: string;
  description: string | null;
  timestamp: string;
  metadata: Record<string, unknown>;
}

export interface DashboardMetrics {
  project_id: string;
  ingestion_status: string;
  tasks_total: number;
  tasks_todo: number;
  tasks_in_progress: number;
  tasks_done: number;
  ai_questions_asked: number;
  files_ingested: number;
  memory_ready: boolean;
}

// ---- API methods ----

export const api = {
  projects: {
    list: (orgId: string) =>
      apiFetch<Project[]>(`/organizations/${orgId}/projects`),
    create: (orgId: string, data: { name: string; description?: string; repo_url?: string }) =>
      apiFetch<Project>(`/organizations/${orgId}/projects`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    get: (orgId: string, projectId: string) =>
      apiFetch<Project>(`/organizations/${orgId}/projects/${projectId}`),
  },

  ingestion: {
    start: (orgId: string, projectId: string) =>
      apiFetch<{ job_id: string; status: string }>(`/organizations/${orgId}/projects/${projectId}/ingest`, {
        method: "POST",
      }),
    status: (orgId: string, projectId: string) =>
      apiFetch<IngestionStatus>(`/organizations/${orgId}/projects/${projectId}/ingest/status`),
  },

  memory: {
    ask: (projectId: string, question: string) =>
      apiFetch<AskResponse>(`/projects/${projectId}/ask`, {
        method: "POST",
        body: JSON.stringify({ question }),
      }),
    search: (projectId: string, q: string, limit = 10) =>
      apiFetch<{ query: string; results: SearchResult[] }>(
        `/projects/${projectId}/search?q=${encodeURIComponent(q)}&limit=${limit}`
      ),
  },

  tasks: {
    list: (projectId: string) =>
      apiFetch<Task[]>(`/projects/${projectId}/tasks`),
    create: (projectId: string, data: { title: string; description?: string; category?: string }) =>
      apiFetch<Task>(`/projects/${projectId}/tasks`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    generate: (projectId: string, feature_description: string) =>
      apiFetch<{ tasks: Task[] }>(`/projects/${projectId}/tasks/generate`, {
        method: "POST",
        body: JSON.stringify({ feature_description }),
      }),
    updateStatus: (projectId: string, taskId: string, status: string) =>
      apiFetch<Task>(`/projects/${projectId}/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
  },

  graph: {
    get: (projectId: string, nodeType?: string) => {
      const qs = nodeType ? `?node_type=${nodeType}` : "";
      return apiFetch<GraphData>(`/projects/${projectId}/graph${qs}`);
    },
  },

  timeline: {
    get: (projectId: string) =>
      apiFetch<TimelineEvent[]>(`/projects/${projectId}/timeline`),
  },

  dashboard: {
    get: (projectId: string) =>
      apiFetch<DashboardMetrics>(`/projects/${projectId}/dashboard`),
  },

  onboarding: {
    get: (projectId: string) =>
      apiFetch<{ project_id: string; guide: string }>(`/projects/${projectId}/onboarding`),
  },
};
