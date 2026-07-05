/**
 * Lightweight typed fetch wrapper for client components.
 * Server components use api-client.ts (which uses Clerk server-side auth).
 * This file is for "use client" components that call useAuth().getToken().
 */

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const V1 = `${API}/api/v1`;

export async function apiFetch<T>(
  path: string,
  token: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${V1}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers as Record<string, string>),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `HTTP ${res.status}`);
  }
  return res.json();
}

// Safe version — returns empty array/null instead of throwing
export async function apiFetchSafe<T>(
  path: string,
  token: string,
  fallback: T,
  options: RequestInit = {}
): Promise<T> {
  try {
    return await apiFetch<T>(path, token, options);
  } catch {
    return fallback;
  }
}

// ---- Types ----

export interface OrgMember {
  user_id: string;
  role: "manager" | "employee";
  email: string | null;
  name: string | null;
}

export interface ProjectAssignment {
  id: string;
  project_id: string;
  employee_id: string;
  assigned_by: string;
  assigned_at: string;
}

export interface Ticket {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  category: string | null;
  assigned_to: string | null;
  assigned_by: string | null;
  progress: number;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  repo_url: string | null;
  repo_default_branch: string | null;
  ingestion_status: string;
  created_by: string;
  created_at: string;
}
