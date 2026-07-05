"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { Loader2, Zap, Users, CheckCircle, Clock, Brain, RefreshCw } from "lucide-react";
import { apiFetchSafe } from "@/lib/api";

interface TicketSummary {
  id: string;
  title: string;
  category: string | null;
  progress: number;
  assigned_to: string | null;
  assignee_name: string | null;
  agent_actions_count: number;
}

interface EmployeeSummary {
  user_id: string;
  name: string | null;
  email: string | null;
  tickets_assigned: number;
  avg_progress: number;
  agent_actions: number;
}

interface ManagerDashboard {
  project_id: string;
  project_name: string;
  ingestion_status: string;
  memory_ready: boolean;
  files_ingested: number;
  ai_questions_asked: number;
  tickets_total: number;
  tickets_avg_progress: number;
  tickets: TicketSummary[];
  employees: EmployeeSummary[];
  total_agent_actions: number;
}

function ProgressBar({ value, color = "blue" }: { value: number; color?: string }) {
  const colorClass =
    value >= 80 ? "bg-emerald-500" :
    value >= 40 ? "bg-blue-500" :
    value > 0 ? "bg-amber-500" : "bg-white/10";
  return (
    <div className="w-full bg-white/10 rounded-full h-1.5">
      <div className={`${colorClass} h-1.5 rounded-full transition-all duration-700`}
        style={{ width: `${value}%` }} />
    </div>
  );
}

export default function ManagerDashboardPage({ params }: { params: { id: string } }) {
  const { getToken } = useAuth();
  const [data, setData] = useState<ManagerDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const token = await getToken() ?? "";
    const d = await apiFetchSafe<ManagerDashboard | null>(
      `/projects/${params.id}/manager-dashboard`, token, null
    );
    setData(d);
    setLastUpdated(new Date());
    setLoading(false);
  }, [getToken, params.id]);

  // Initial load + poll every 5s
  useEffect(() => {
    load();
    const interval = setInterval(() => load(true), 5000);
    return () => clearInterval(interval);
  }, [load]);

  if (loading && !data) {
    return (
      <div className="p-8 flex items-center gap-2 text-white/40">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading dashboard...
      </div>
    );
  }

  if (!data) {
    return <div className="p-8 text-white/40 text-sm">Could not load dashboard.</div>;
  }

  return (
    <div className="w-full px-6 md:px-10 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-lg">Manager Dashboard</h1>
          <p className="text-xs text-white/30 mt-0.5">
            Auto-refreshes every 5s
            {lastUpdated && ` · Updated ${lastUpdated.toLocaleTimeString()}`}
          </p>
        </div>
        <button onClick={() => load()} className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {/* Top metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total tickets", value: data.tickets_total, icon: <CheckCircle className="h-4 w-4 text-white/30" /> },
          { label: "Avg progress", value: `${data.tickets_avg_progress}%`, icon: <Zap className="h-4 w-4 text-blue-400" /> },
          { label: "Agent actions", value: data.total_agent_actions, icon: <Brain className="h-4 w-4 text-purple-400" /> },
          { label: "AI questions", value: data.ai_questions_asked, icon: <Brain className="h-4 w-4 text-white/30" /> },
        ].map((m) => (
          <div key={m.label} className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-white/40">{m.label}</span>
              {m.icon}
            </div>
            <div className="text-2xl font-bold">{m.value}</div>
          </div>
        ))}
      </div>

      {/* Overall progress bar */}
      {data.tickets_total > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">Overall project progress</span>
            <span className="text-lg font-bold text-blue-400">{data.tickets_avg_progress}%</span>
          </div>
          <ProgressBar value={data.tickets_avg_progress} />
        </div>
      )}

      {/* Per-employee breakdown */}
      {data.employees.length > 0 && (
        <div>
          <h2 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Users className="h-4 w-4 text-white/40" /> Team Progress
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {/* Sort employees by agent_actions descending */}
        {[...data.employees].sort((a, b) => b.agent_actions - a.agent_actions).map((e) => (
              <div key={e.user_id} className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium">{e.name ?? e.email ?? "Unknown"}</p>
                    <p className="text-xs text-white/30">
                      {e.tickets_assigned} ticket{e.tickets_assigned !== 1 ? "s" : ""} · {e.agent_actions} agent action{e.agent_actions !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <span className={`text-lg font-bold ${
                    e.avg_progress >= 80 ? "text-emerald-400" :
                    e.avg_progress >= 40 ? "text-blue-400" : "text-white/40"
                  }`}>{Math.round(e.avg_progress)}%</span>
                </div>
                <ProgressBar value={e.avg_progress} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tickets list */}
      {data.tickets.length > 0 && (
        <div>
          <h2 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-white/40" /> Tickets
          </h2>
          <div className="space-y-2">
            {data.tickets.map((t) => (
              <div key={t.id} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {t.category && (
                      <span className={`text-xs px-1.5 py-0.5 rounded border flex-shrink-0 ${
                        t.category === "backend" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                        t.category === "frontend" ? "bg-purple-500/10 text-purple-400 border-purple-500/20" :
                        t.category === "database" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                        t.category === "testing" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                        "bg-white/5 text-white/40 border-white/10"
                      }`}>{t.category}</span>
                    )}
                    <span className="text-sm truncate">{t.title}</span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {t.assignee_name && (
                      <span className="text-xs text-white/30">{t.assignee_name}</span>
                    )}
                    {t.agent_actions_count > 0 && (
                      <span className="flex items-center gap-1 text-xs text-purple-400">
                        <Zap className="h-3 w-3" />{t.agent_actions_count}
                      </span>
                    )}
                    <span className={`text-sm font-semibold w-10 text-right ${
                      t.progress >= 80 ? "text-emerald-400" :
                      t.progress >= 40 ? "text-blue-400" : "text-white/40"
                    }`}>{t.progress}%</span>
                  </div>
                </div>
                <ProgressBar value={t.progress} />
              </div>
            ))}
          </div>
        </div>
      )}

      {data.tickets.length === 0 && (
        <div className="text-center py-12 border border-dashed border-white/10 rounded-xl">
          <Clock className="h-8 w-8 text-white/20 mx-auto mb-3" />
          <p className="text-sm text-white/40">No tickets yet. Create tickets and assign them to employees.</p>
        </div>
      )}
    </div>
  );
}
