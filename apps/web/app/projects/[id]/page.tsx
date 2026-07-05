import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  GitBranch, CheckCircle, Clock, AlertCircle, Play,
  MessageSquare, Network, CheckSquare, Search,
  Zap, FileCode2, BarChart3, Users, Settings, RefreshCw
} from "lucide-react";

const DEFAULT_ORG_ID = process.env.DEFAULT_ORG_ID ?? process.env.NEXT_PUBLIC_DEFAULT_ORG_ID ?? "";
const API_BASE = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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
  const map: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
    completed:   { label: "Completed",   className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25", icon: <CheckCircle className="h-3.5 w-3.5" /> },
    in_progress: { label: "In progress", className: "bg-amber-500/10  text-amber-400  border-amber-500/25",  icon: <Clock className="h-3.5 w-3.5 animate-pulse" /> },
    queued:      { label: "Queued",      className: "bg-blue-500/10   text-blue-400   border-blue-500/25",   icon: <Clock className="h-3.5 w-3.5" /> },
    failed:      { label: "Failed",      className: "bg-red-500/10    text-red-400    border-red-500/25",    icon: <AlertCircle className="h-3.5 w-3.5" /> },
    not_started: { label: "Not started", className: "bg-white/5       text-white/40   border-white/10",      icon: <Clock className="h-3.5 w-3.5" /> },
  };
  const s = map[status] ?? map.not_started;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium border px-3 py-1 rounded-full ${s.className}`}>
      {s.icon}{s.label}
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
    return <div className="w-full min-h-full bg-slate-950 flex items-center justify-center text-white/40 text-sm">Project not found.</div>;
  }

  const quickLinks = [
    { href: "ask",        label: "AI Tech Lead",    sub: "Ask anything about this codebase",  icon: MessageSquare,  color: "text-blue-400",   bg: "bg-blue-500/10",   border: "border-blue-500/20" },
    { href: "editor",     label: "Code Editor",     sub: "Browse and edit files with AI",      icon: FileCode2,      color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20" },
    { href: "tickets",    label: "Tickets",          sub: "Manage tasks and track progress",    icon: CheckSquare,    color: "text-emerald-400",bg: "bg-emerald-500/10",border: "border-emerald-500/20" },
    { href: "graph",      label: "Knowledge Graph",  sub: "Explore relationships visually",     icon: Network,        color: "text-cyan-400",   bg: "bg-cyan-500/10",   border: "border-cyan-500/20" },
    { href: "search",     label: "Smart Search",     sub: "Semantic search over project memory",icon: Search,         color: "text-amber-400",  bg: "bg-amber-500/10",  border: "border-amber-500/20" },
    { href: "dashboard",  label: "Dashboard",        sub: "Team progress and metrics",          icon: BarChart3,      color: "text-rose-400",   bg: "bg-rose-500/10",   border: "border-rose-500/20" },
    { href: "onboarding", label: "Onboarding",       sub: "AI guide for new developers",        icon: Users,          color: "text-indigo-400", bg: "bg-indigo-500/10", border: "border-indigo-500/20" },
    { href: "settings",   label: "Settings",         sub: "Project configuration",              icon: Settings,       color: "text-white/40",   bg: "bg-white/5",       border: "border-white/10" },
  ];

  return (
    <div className="w-full min-h-full bg-slate-950 px-6 md:px-10 py-8">

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="min-w-0 flex-1 mr-4">
          <h1 className="text-2xl font-bold text-white mb-1 truncate">{project.name}</h1>
          {project.description && (
            <p className="text-sm text-white/50 mb-2">{project.description}</p>
          )}
          {project.repo_url && (
            <a href={project.repo_url} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-white/30 hover:text-blue-400 transition-colors">
              <GitBranch className="h-3.5 w-3.5" />
              {project.repo_url.replace("https://github.com/", "")}
            </a>
          )}
        </div>
        <StatusBadge status={project.ingestion_status} />
      </div>

      {/* Ingestion CTA */}
      {(project.ingestion_status === "not_started" || project.ingestion_status === "failed") && (
        <div className={`mb-8 rounded-xl p-5 border flex items-start gap-4 ${
          project.ingestion_status === "failed"
            ? "bg-red-500/5 border-red-500/20"
            : "bg-blue-500/5 border-blue-500/20"
        }`}>
          <div className={`p-2 rounded-lg flex-shrink-0 ${
            project.ingestion_status === "failed" ? "bg-red-500/10" : "bg-blue-500/10"
          }`}>
            {project.ingestion_status === "failed"
              ? <AlertCircle className="h-5 w-5 text-red-400" />
              : <Zap className="h-5 w-5 text-blue-400" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium mb-0.5">
              {project.ingestion_status === "failed" ? "Ingestion failed" : "Build knowledge graph"}
            </p>
            <p className="text-xs text-white/50 mb-3">
              {project.ingestion_status === "failed"
                ? "Fix the repo URL in Settings, then retry."
                : "Connect to GitHub and ingest this repo to unlock all AI features."}
            </p>
            <div className="flex gap-2">
              <Link href={`/projects/${params.id}/ingest`}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
                <Play className="h-3.5 w-3.5" />
                {project.ingestion_status === "failed" ? "Retry ingestion" : "Start ingestion"}
              </Link>
              {project.ingestion_status === "failed" && (
                <Link href={`/projects/${params.id}/settings`}
                  className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/15 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
                  <Settings className="h-3.5 w-3.5" />
                  Fix repo URL
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Metrics */}
      {metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { label: "Tasks",        value: metrics.tasks_total,       icon: <CheckSquare className="h-4 w-4 text-white/30" /> },
            { label: "Done",         value: metrics.tasks_done,        icon: <CheckCircle className="h-4 w-4 text-emerald-400/60" /> },
            { label: "AI questions", value: metrics.ai_questions_asked, icon: <MessageSquare className="h-4 w-4 text-blue-400/60" /> },
            { label: "Files indexed",value: metrics.files_ingested,    icon: <FileCode2 className="h-4 w-4 text-purple-400/60" /> },
          ].map((m) => (
            <div key={m.label} className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-white/40">{m.label}</span>
                {m.icon}
              </div>
              <div className="text-2xl font-bold text-white">{m.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Quick links grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {quickLinks.map(({ href, label, sub, icon: Icon, color, bg, border }) => (
          <Link key={href} href={`/projects/${params.id}/${href}`}
            className="group flex flex-col gap-3 bg-white/[0.03] border border-white/10 hover:border-white/20 hover:bg-white/[0.06] rounded-xl p-4 transition-all">
            <div className={`w-9 h-9 rounded-lg ${bg} border ${border} flex items-center justify-center flex-shrink-0`}>
              <Icon className={`h-4.5 w-4.5 ${color}`} />
            </div>
            <div>
              <p className="text-sm font-medium text-white group-hover:text-white transition-colors">{label}</p>
              <p className="text-xs text-white/40 mt-0.5 leading-snug">{sub}</p>
            </div>
          </Link>
        ))}
      </div>

    </div>
  );
}
