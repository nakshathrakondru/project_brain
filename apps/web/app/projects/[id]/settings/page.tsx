"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { Settings, Save, Loader2, CheckCircle, GitBranch, RefreshCw } from "lucide-react";

const DEFAULT_ORG_ID = process.env.NEXT_PUBLIC_DEFAULT_ORG_ID ?? "";

export default function SettingsPage({ params }: { params: { id: string } }) {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    repo_url: "",
    repo_default_branch: "main",
  });

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/v1/organizations/${DEFAULT_ORG_ID}/projects/${params.id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.ok) {
          const data = await res.json();
          setForm({
            name: data.name ?? "",
            description: data.description ?? "",
            repo_url: data.repo_url ?? "",
            repo_default_branch: data.repo_default_branch ?? "main",
          });
        }
      } catch {
        setError("Failed to load project");
      } finally {
        setLoading(false);
      }
    })();
  }, [params.id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const token = await getToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/organizations/${DEFAULT_ORG_ID}/projects/${params.id}`,
        { method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(form) }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail ?? "Failed to save");
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full min-h-full bg-slate-950 flex items-center gap-2 px-10 py-8 text-white/40">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading...
      </div>
    );
  }

  return (
    <div className="w-full min-h-full bg-slate-950 px-6 md:px-10 py-8">
      <div className="max-w-2xl">

        <div className="flex items-center gap-2 mb-8">
          <Settings className="h-5 w-5 text-white/40" />
          <h1 className="text-lg font-semibold">Project Settings</h1>
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-1.5">Project name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors resize-none" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5 flex items-center gap-1.5">
              <GitBranch className="h-3.5 w-3.5 text-white/40" />
              GitHub repo URL
            </label>
            <input value={form.repo_url} onChange={(e) => setForm({ ...form, repo_url: e.target.value })}
              placeholder="https://github.com/owner/repo"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors font-mono" />
            <p className="text-xs text-white/30 mt-1.5 flex items-center gap-1">
              <RefreshCw className="h-3 w-3" /> Changing the repo URL resets ingestion status
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Default branch</label>
            <input value={form.repo_default_branch} onChange={(e) => setForm({ ...form, repo_default_branch: e.target.value })}
              placeholder="main"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors" />
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2.5">{error}</p>
          )}
          {saved && (
            <p className="text-emerald-400 text-sm bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-2.5 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" /> Saved successfully
            </p>
          )}

          <button type="submit" disabled={saving}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2.5 rounded-lg text-sm font-medium transition-colors">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving..." : "Save changes"}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-white/10">
          <p className="text-xs text-white/20 font-mono">Project ID: {params.id}</p>
        </div>

      </div>
    </div>
  );
}
