"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Plus, Loader2, Sparkles, CheckCircle, Circle, Clock } from "lucide-react";

interface Task {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  status: "todo" | "in_progress" | "done";
  source: "ai_generated" | "manual";
}

const CATEGORY_COLORS: Record<string, string> = {
  backend: "bg-blue-500/10 text-blue-400",
  frontend: "bg-violet-500/10 text-violet-400",
  database: "bg-amber-500/10 text-amber-400",
  testing: "bg-emerald-500/10 text-emerald-400",
  deployment: "bg-orange-500/10 text-orange-400",
};

export default function TasksPage({ params }: { params: { id: string } }) {
  const { getToken } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [featureInput, setFeatureInput] = useState("");
  const [showGenerate, setShowGenerate] = useState(false);

  const fetchTasks = async () => {
    const token = await getToken();
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/v1/projects/${params.id}/tasks`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (res.ok) setTasks(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchTasks(); }, []);

  const generateTasks = async () => {
    if (!featureInput.trim()) return;
    setGenerating(true);
    const token = await getToken();
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/v1/projects/${params.id}/tasks/generate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ feature_description: featureInput }),
      }
    );
    if (res.ok) {
      const data = await res.json();
      setTasks((prev) => [...data.tasks, ...prev]);
      setFeatureInput("");
      setShowGenerate(false);
    }
    setGenerating(false);
  };

  const updateStatus = async (taskId: string, status: string) => {
    const token = await getToken();
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/v1/projects/${params.id}/tasks/${taskId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      }
    );
    if (res.ok) {
      const updated = await res.json();
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
    }
  };

  const columns = [
    { id: "todo", label: "To Do", icon: <Circle className="h-3.5 w-3.5 text-white/40" /> },
    { id: "in_progress", label: "In Progress", icon: <Clock className="h-3.5 w-3.5 text-amber-400" /> },
    { id: "done", label: "Done", icon: <CheckCircle className="h-3.5 w-3.5 text-emerald-400" /> },
  ];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-semibold text-lg">Tasks</h1>
          <p className="text-xs text-white/40 mt-0.5">{tasks.length} tasks</p>
        </div>
        <button
          onClick={() => setShowGenerate(!showGenerate)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Sparkles className="h-4 w-4" />
          Generate tasks
        </button>
      </div>

      {showGenerate && (
        <div className="mb-6 bg-white/5 border border-white/10 rounded-xl p-4">
          <p className="text-sm text-white/60 mb-3">Describe a feature to generate tasks from your project's memory:</p>
          <div className="flex gap-2">
            <input
              value={featureInput}
              onChange={(e) => setFeatureInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && generateTasks()}
              placeholder="e.g. Add user authentication with JWT"
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={generateTasks}
              disabled={generating || !featureInput.trim()}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 px-4 py-2 rounded-lg text-sm font-medium"
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Generate
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-white/40 py-8">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading tasks...
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {columns.map((col) => {
            const colTasks = tasks.filter((t) => t.status === col.id);
            return (
              <div key={col.id} className="bg-white/3 border border-white/8 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-3 px-1">
                  {col.icon}
                  <span className="text-sm font-medium">{col.label}</span>
                  <span className="ml-auto text-xs text-white/30">{colTasks.length}</span>
                </div>
                <div className="space-y-2">
                  {colTasks.map((task) => (
                    <div
                      key={task.id}
                      className="bg-slate-900 border border-white/10 rounded-lg p-3"
                    >
                      <p className="text-sm font-medium mb-1">{task.title}</p>
                      {task.description && (
                        <p className="text-xs text-white/40 mb-2 line-clamp-2">{task.description}</p>
                      )}
                      <div className="flex items-center gap-1.5">
                        {task.category && (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${CATEGORY_COLORS[task.category] ?? "bg-white/5 text-white/40"}`}>
                            {task.category}
                          </span>
                        )}
                        {task.source === "ai_generated" && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400">AI</span>
                        )}
                      </div>
                      {/* Status actions */}
                      <div className="mt-2 flex gap-1">
                        {col.id !== "in_progress" && (
                          <button
                            onClick={() => updateStatus(task.id, "in_progress")}
                            className="text-xs text-white/30 hover:text-amber-400 transition-colors"
                          >
                            → In Progress
                          </button>
                        )}
                        {col.id !== "done" && (
                          <button
                            onClick={() => updateStatus(task.id, "done")}
                            className="text-xs text-white/30 hover:text-emerald-400 transition-colors ml-auto"
                          >
                            Mark done
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
