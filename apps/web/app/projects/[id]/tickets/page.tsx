"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Plus, Loader2, Ticket, ChevronRight } from "lucide-react";
import Link from "next/link";
import { apiFetch, apiFetchSafe, type Ticket as TicketType, type OrgMember } from "@/lib/api";

const DEFAULT_ORG_ID = process.env.NEXT_PUBLIC_DEFAULT_ORG_ID ?? "";

const CATEGORIES = ["backend", "frontend", "database", "testing", "deployment"];

function ProgressBar({ value }: { value: number }) {
  const color =
    value >= 80 ? "bg-emerald-500" : value >= 40 ? "bg-blue-500" : "bg-white/20";
  return (
    <div className="w-full bg-white/10 rounded-full h-1.5 mt-2">
      <div
        className={`${color} h-1.5 rounded-full transition-all duration-500`}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

export default function TicketsPage({ params }: { params: { id: string } }) {
  const { getToken } = useAuth();
  const [tickets, setTickets] = useState<TicketType[]>([]);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "backend",
    assigned_to: "",
  });

  const load = async () => {
    const token = await getToken() ?? "";
    const [t, m] = await Promise.all([
      apiFetchSafe<TicketType[]>(`/projects/${params.id}/tickets`, token, []),
      apiFetchSafe<OrgMember[]>(`/organizations/${DEFAULT_ORG_ID}/members`, token, []),
    ]);
    setTickets(t);
    setMembers(m.filter((x) => x.role === "employee"));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const createTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const token = await getToken() ?? "";
      await apiFetch(`/projects/${params.id}/tickets`, token, {
        method: "POST",
        body: JSON.stringify({
          title: form.title,
          description: form.description || null,
          category: form.category,
          assigned_to: form.assigned_to || null,
        }),
      });
      setForm({ title: "", description: "", category: "backend", assigned_to: "" });
      setShowForm(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create ticket");
    } finally {
      setCreating(false);
    }
  };

  const memberName = (id: string | null) => {
    if (!id) return null;
    const m = members.find((x) => x.user_id === id);
    return m?.name ?? m?.email ?? id.slice(0, 8);
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center gap-2 text-white/40">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading tickets...
      </div>
    );
  }

  return (
    <div className="w-full px-6 md:px-10 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-semibold text-lg">Tickets</h1>
          <p className="text-xs text-white/40 mt-0.5">
            {tickets.length} ticket{tickets.length !== 1 ? "s" : ""} · Progress tracked by AI agent
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="h-4 w-4" />
          New ticket
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={createTicket} className="mb-6 bg-white/5 border border-white/10 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-medium">Create ticket</h2>
          <input
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Ticket title *"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          />
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Description (optional)"
            rows={2}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none"
          />
          <div className="flex gap-3">
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select
              value={form.assigned_to}
              onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.name ?? m.email}
                </option>
              ))}
            </select>
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={creating}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {creating && <Loader2 className="h-3 w-3 animate-spin" />}
              Create
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg text-sm text-white/40 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Ticket list */}
      {tickets.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-white/10 rounded-xl">
          <Ticket className="h-8 w-8 text-white/20 mx-auto mb-3" />
          <p className="text-sm text-white/40">No tickets yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {tickets.map((t) => (
            <Link
              key={t.id}
              href={`/projects/${params.id}/tickets/${t.id}`}
              className="block bg-white/5 border border-white/10 hover:border-white/20 rounded-xl p-4 transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${
                      t.category === "backend" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                      t.category === "frontend" ? "bg-purple-500/10 text-purple-400 border-purple-500/20" :
                      t.category === "database" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                      t.category === "testing" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                      "bg-white/5 text-white/40 border-white/10"
                    }`}>
                      {t.category ?? "general"}
                    </span>
                    {t.assigned_to && (
                      <span className="text-xs text-white/30">
                        → {memberName(t.assigned_to)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium truncate">{t.title}</p>
                  {t.description && (
                    <p className="text-xs text-white/40 mt-1 line-clamp-1">{t.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-white/40">{t.progress}%</span>
                    <div className="flex-1">
                      <ProgressBar value={t.progress} />
                    </div>
                    <span className="text-xs text-white/20 flex-shrink-0">
                      {new Date(t.updated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-white/20 flex-shrink-0 mt-1" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
