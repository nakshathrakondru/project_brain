import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { GitBranch, Zap, CheckCircle, Clock, AlertCircle, Play } from "lucide-react";

const DEFAULT_ORG_ID = process.env.DEFAULT_ORG_ID ?? "";
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function getProject(orgId: string, projectId: string, token: string) {
  const res = await fetch(`${API_BASE}/api/v1/organizations/${orgId}/projects/${projectId}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

async function getDashboard(projectId: string, token: string) {
  const res = await fetch(`${API_BASE}/api/v1/projects/${projectId}/dashboard`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    completed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    in_progress: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    queued: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    failed: "bg-red-500/10 text-red-400 border-red-500/20",
    not_started: "bg-white/5 text-white/40 border-white/10",
  };
  const icons: Record<string, React.ReactNode> = {
    completed: <CheckCircle className="h-3.5 w-3.5" />,
    in_progress: <Clock className="h-3.5 w-3.5 animate-pulse" />,
    queued: <Clock className="h-3.5 w-3.5" />,
    failed: <AlertCircle className="h-3.5 w-3.5" />,
    not_started: <Clock className="h-3.5 w-3.5" />,
  };
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs border px-2.5 py-1 rounded-full ${styles[status] ?? styles.not_started}`}>
      {icons[status]}
      {status.replace("_", " ")}
    </span>
  );
}

export default async function ProjectOverviewPage({ params }: { params: { id: string } }) {
  const { userId, getToken } = auth();
  if (!userId) redirect("/sign-in");

  const token = await getToken() ?? "";
  const [project, metrics] = await Promise.all([
    getProject(DEFAULT_ORG_ID, params.id, token),
    getDashboard(params.id, token),
  ]);

  if (!project) {
    return <div className="p-8 text-white/50">Project not found.</div>;
  }

  const quickLinks = [
    { href: "ask", label: "Ask a question", icon: "💬", desc: "AI Tech Lead" },
    { href: "graph", label: "Explore graph", icon: "🕸️", desc: "Knowledge graph" },
    { href: "tasks", label: "View tasks", icon: "✅", desc: "Task board" },
    { href: "search", label: "Search memory", icon: "🔍", desc: "Semantic search" },
  ];

  return (
    <div className="p-8 max-w-4xl">
      {/* Project header */}
      <div className="mb-8">
        <div className="flex items-start justify-between mb-2">
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <StatusBadge status={project.ingestion_status} />
        </div>
        {project.description && (
          <p className="text-white/50 text-sm mb-3">{project.description}</p>
        )}
        {project.repo_url && (
          <a
            href={project.repo_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors"
          >
            <GitBranch className="h-3.5 w-3.5" />
            {project.repo_url}
          </a>
        )}
      </div>

      {/* Ingestion CTA if not started */}
      {project.ingestion_status === "not_started" && project.repo_url && (
        <div className="mb-8 bg-blue-500/5 border border-blue-500/20 rounded-xl p-6">
          <h3 className="font-medium mb-1">Ready to build your knowledge graph</h3>
          <p className="text-sm text-white/50 mb-4">
            Ingest the GitHub repo to unlock AI Tech Lead, Search, and Graph features.
          </p>
          <Link
            href={`/projects/${params.id}/ingest`}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Play className="h-4 w-4" />
            Start ingestion
          </Link>
        </div>
      )}

      {/* Metrics */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Tasks", value: metrics.tasks_total },
            { label: "Done", value: metrics.tasks_done },
            { label: "AI questions", value: metrics.ai_questions_asked },
            { label: "Files ingested", value: metrics.files_ingested },
          ].map((m) => (
            <div key={m.label} className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="text-2xl font-bold">{m.value}</div>
              <div className="text-xs text-white/40 mt-1">{m.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3">
        {quickLinks.map((l) => (
          <Link
            key={l.href}
            href={`/projects/${params.id}/${l.href}`}
            className="flex items-center gap-3 bg-white/5 border border-white/10 hover:border-white/20 rounded-xl p-4 transition-all"
          >
            <span className="text-2xl">{l.icon}</span>
            <div>
              <div className="font-medium text-sm">{l.label}</div>
              <div className="text-xs text-white/40">{l.desc}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
