import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Brain, Plus, GitBranch, CheckCircle, Clock, AlertCircle, Users } from "lucide-react";
import DeleteProjectButton from "@/components/DeleteProjectButton";

const DEFAULT_ORG_ID = process.env.NEXT_PUBLIC_DEFAULT_ORG_ID ?? "";
const API = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function fetchJSON(url: string, token: string) {
  try {
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!r.ok) return null;
    return r.json();
  } catch {
    return null;
  }
}

function statusIcon(status: string) {
  switch (status) {
    case "completed": return <CheckCircle className="h-4 w-4 text-emerald-500" />;
    case "in_progress":
    case "queued": return <Clock className="h-4 w-4 text-amber-500 animate-pulse" />;
    case "failed": return <AlertCircle className="h-4 w-4 text-red-500" />;
    default: return <Clock className="h-4 w-4 text-slate-400" />;
  }
}

export default async function DashboardPage() {
  const { userId, getToken } = auth();
  if (!userId) redirect("/sign-in");

  const token = (await getToken()) ?? "";

  // Get current user info + org members to determine role
  const [projects, members, myAssignments] = await Promise.all([
    DEFAULT_ORG_ID
      ? fetchJSON(`${API}/api/v1/organizations/${DEFAULT_ORG_ID}/projects`, token)
      : null,
    DEFAULT_ORG_ID
      ? fetchJSON(`${API}/api/v1/organizations/${DEFAULT_ORG_ID}/members`, token)
      : null,
    fetchJSON(`${API}/api/v1/users/me/assignments`, token),
  ]);

  // Determine current user's role
  const me = await fetchJSON(`${API}/api/v1/auth/me`, token);
  const myMembership = members?.find((m: any) => m.user_id === me?.id);
  // Default to manager if we can't determine role (avoids dead-end employee screen)
  const isManager = !myMembership || myMembership?.role === "manager";

  const projectList: any[] = projects ?? [];
  const assignedProjectIds = new Set((myAssignments ?? []).map((a: any) => a.project_id));

  // Employees only see assigned projects
  const visibleProjects = isManager
    ? projectList
    : projectList.filter((p: any) => assignedProjectIds.has(p.id));

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-white/10 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-blue-400" />
          <span className="font-semibold">Mycelium</span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs px-2.5 py-1 rounded-full border ${
            isManager
              ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
              : "bg-white/5 text-white/40 border-white/10"
          }`}>
            {isManager ? "Manager" : "Employee"}
          </span>
          {isManager && DEFAULT_ORG_ID && (
            <Link
              href={`/org/${DEFAULT_ORG_ID}/members`}
              className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
            >
              <Users className="h-3.5 w-3.5" />
              Team
            </Link>
          )}
        </div>
      </header>

      <main className="w-full px-6 md:px-10 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">
              {isManager ? "Projects" : "My Assigned Projects"}
            </h1>
            <p className="text-white/50 text-sm mt-1">
              {isManager
                ? "Manage projects, assign team members, and track progress"
                : "Your assigned projects and tickets"}
            </p>
          </div>
          {isManager && (
            <Link
              href="/projects/new"
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="h-4 w-4" />
              New project
            </Link>
          )}
        </div>

        {visibleProjects.length === 0 ? (
          <div className="text-center py-24 border border-dashed border-white/10 rounded-xl">
            <Brain className="h-10 w-10 text-white/20 mx-auto mb-4" />
            <h3 className="font-medium text-white/60 mb-2">
              {isManager ? "No projects yet" : "No projects assigned to you yet"}
            </h3>
            <p className="text-sm text-white/30 mb-6">
              {isManager
                ? "Create a project and connect a GitHub repo to get started."
                : "Ask your manager to assign you to a project."}
            </p>
            {isManager && (
              <Link
                href="/projects/new"
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <Plus className="h-4 w-4" />
                Create first project
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {visibleProjects.map((p: any) => (
              <div
                key={p.id}
                className={`rounded-xl border transition-all ${
                  p.ingestion_status === "failed"
                    ? "bg-white/[0.03] border-red-500/30 border-l-2 border-l-red-500/60 hover:bg-white/[0.06]"
                    : "bg-white/[0.03] border-white/10 hover:bg-white/[0.06] hover:border-white/20"
                }`}
              >
                <Link href={`/projects/${p.id}`} className="block p-5">
                  <div className="flex items-start justify-between mb-2">
                    <h2 className="font-semibold text-sm">{p.name}</h2>
                    <div className="flex items-center gap-1.5 text-xs text-white/40 flex-shrink-0 ml-2">
                      {statusIcon(p.ingestion_status)}
                      {p.ingestion_status.replace("_", " ")}
                    </div>
                  </div>
                  {p.description && (
                    <p className="text-sm text-white/50 mb-3 line-clamp-2">{p.description}</p>
                  )}
                  {p.repo_url && (
                    <div className="flex items-center gap-1.5 text-xs text-white/30 truncate">
                      <GitBranch className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{p.repo_url.replace("https://github.com/", "")}</span>
                    </div>
                  )}
                </Link>
                {isManager && (
                  <div className="px-5 pb-4 flex items-center justify-between border-t border-white/5 pt-3">
                    <div className="flex gap-3">
                      <Link href={`/projects/${p.id}/tickets`} className="text-xs text-white/30 hover:text-white/60 transition-colors">Tickets</Link>
                      <span className="text-white/10">·</span>
                      <Link href={`/projects/${p.id}/team`} className="text-xs text-white/30 hover:text-white/60 transition-colors">Assign team</Link>
                      <span className="text-white/10">·</span>
                      <Link href={`/projects/${p.id}`} className="text-xs text-white/30 hover:text-white/60 transition-colors">Open →</Link>
                    </div>
                    <DeleteProjectButton
                      projectId={p.id}
                      projectName={p.name}
                      orgId={DEFAULT_ORG_ID}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
