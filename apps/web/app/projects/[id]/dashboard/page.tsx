import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { CheckCircle, Clock, AlertCircle, MessageSquare, FileText, BarChart3 } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default async function ProjectDashboardPage({ params }: { params: { id: string } }) {
  const { userId, getToken } = auth();
  if (!userId) redirect("/sign-in");

  const token = await getToken() ?? "";
  const res = await fetch(`${API_BASE}/api/v1/projects/${params.id}/dashboard`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    return <div className="p-8 text-white/50">Could not load dashboard.</div>;
  }

  const m = await res.json();

  const metrics = [
    { label: "Tasks total", value: m.tasks_total, icon: <BarChart3 className="h-4 w-4 text-white/40" /> },
    { label: "To do", value: m.tasks_todo, icon: <Circle className="h-4 w-4 text-white/40" /> },
    { label: "In progress", value: m.tasks_in_progress, icon: <Clock className="h-4 w-4 text-amber-400" /> },
    { label: "Done", value: m.tasks_done, icon: <CheckCircle className="h-4 w-4 text-emerald-400" /> },
    { label: "AI questions", value: m.ai_questions_asked, icon: <MessageSquare className="h-4 w-4 text-blue-400" /> },
    { label: "Files ingested", value: m.files_ingested, icon: <FileText className="h-4 w-4 text-violet-400" /> },
  ];

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="font-semibold text-lg">Manager Dashboard</h1>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-white/40">Memory status:</span>
          {m.memory_ready ? (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
              <CheckCircle className="h-3 w-3" /> Ready
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-amber-400">
              <AlertCircle className="h-3 w-3" /> {m.ingestion_status}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="bg-white/5 border border-white/10 rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-white/40">{metric.label}</span>
              {metric.icon}
            </div>
            <div className="text-3xl font-bold">{metric.value}</div>
          </div>
        ))}
      </div>

      {/* Completion rate */}
      {m.tasks_total > 0 && (
        <div className="mt-6 bg-white/5 border border-white/10 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">Task completion</span>
            <span className="text-sm text-white/50">
              {Math.round((m.tasks_done / m.tasks_total) * 100)}%
            </span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-2">
            <div
              className="bg-emerald-500 h-2 rounded-full transition-all"
              style={{ width: `${(m.tasks_done / m.tasks_total) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Server component can't import lucide directly in JSX without this
function Circle(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="10" />
    </svg>
  );
}
