import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Brain, Plus, GitBranch, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { api, Project } from "@/lib/api-client";

// Hard-coded org for hackathon — a real impl would pick from user's orgs
const DEFAULT_ORG_ID = process.env.DEFAULT_ORG_ID ?? "";

function statusIcon(status: Project["ingestion_status"]) {
  switch (status) {
    case "completed": return <CheckCircle className="h-4 w-4 text-emerald-500" />;
    case "in_progress":
    case "queued": return <Clock className="h-4 w-4 text-amber-500 animate-pulse" />;
    case "failed": return <AlertCircle className="h-4 w-4 text-red-500" />;
    default: return <Clock className="h-4 w-4 text-slate-400" />;
  }
}

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  let projects: Project[] = [];
  let orgId = DEFAULT_ORG_ID;

  // In a real app we'd fetch the user's orgs first. For hackathon scope,
  // we surface a "create project" CTA if no org is configured.
  if (orgId) {
    try {
      projects = await api.projects.list(orgId);
    } catch {
      // User may not have an org yet
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="border-b border-white/10 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-blue-400" />
          <span className="font-semibold">Project Brain</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-8 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Projects</h1>
            <p className="text-white/50 text-sm mt-1">
              Each project is a self-contained knowledge graph
            </p>
          </div>
          <Link
            href="/projects/new"
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="h-4 w-4" />
            New project
          </Link>
        </div>

        {projects.length === 0 ? (
          <div className="text-center py-24 border border-dashed border-white/10 rounded-xl">
            <Brain className="h-10 w-10 text-white/20 mx-auto mb-4" />
            <h3 className="font-medium text-white/60 mb-2">No projects yet</h3>
            <p className="text-sm text-white/30 mb-6">
              Create a project and connect a GitHub repo to start building your knowledge graph.
            </p>
            <Link
              href="/projects/new"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="h-4 w-4" />
              Create first project
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projects.map((p) => (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="block bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/8 hover:border-white/20 transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <h2 className="font-semibold">{p.name}</h2>
                  <div className="flex items-center gap-1.5 text-xs text-white/40">
                    {statusIcon(p.ingestion_status)}
                    {p.ingestion_status.replace("_", " ")}
                  </div>
                </div>
                {p.description && (
                  <p className="text-sm text-white/50 mb-3 line-clamp-2">{p.description}</p>
                )}
                {p.repo_url && (
                  <div className="flex items-center gap-1.5 text-xs text-white/30">
                    <GitBranch className="h-3 w-3" />
                    {p.repo_url.replace("https://github.com/", "")}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
