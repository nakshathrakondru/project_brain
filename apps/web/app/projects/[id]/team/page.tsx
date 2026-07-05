"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Users, UserPlus, Loader2, CheckCircle, Send } from "lucide-react";
import { apiFetchSafe, type OrgMember, type ProjectAssignment } from "@/lib/api";

const DEFAULT_ORG_ID = process.env.NEXT_PUBLIC_DEFAULT_ORG_ID ?? "";

export default function TeamPage({ params }: { params: { id: string } }) {
  const { getToken } = useAuth();
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [assignments, setAssignments] = useState<ProjectAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"employee" | "manager">("employee");
  const [inviting, setInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const load = async () => {
    const token = await getToken() ?? "";
    const [m, a] = await Promise.all([
      apiFetchSafe<OrgMember[]>(`/organizations/${DEFAULT_ORG_ID}/members`, token, []),
      apiFetchSafe<ProjectAssignment[]>(`/projects/${params.id}/assignments`, token, []),
    ]);
    setMembers(m.filter((x) => x.role === "employee"));
    setAssignments(a);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const assignedIds = new Set(assignments.map((a) => a.employee_id));

  const toggleAssign = async (userId: string, isAssigned: boolean) => {
    setActing(userId);
    setError(null);
    try {
      const token = await getToken() ?? "";
      if (isAssigned) {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/projects/${params.id}/assign/${userId}`,
          { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      } else {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/projects/${params.id}/assign`,
          { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ employee_id: userId }) });
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setActing(null);
    }
  };

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteError(null);
    setInviteSuccess(false);
    try {
      const token = await getToken() ?? "";
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/organizations/${DEFAULT_ORG_ID}/invite`,
        { method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }) }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Invite failed");
      setInviteEmail("");
      setInviteSuccess(true);
      setTimeout(() => setInviteSuccess(false), 3000);
      await load();
    } catch (e) {
      setInviteError(e instanceof Error ? e.message : "Invite failed");
    } finally {
      setInviting(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full min-h-full bg-slate-950 flex items-center gap-2 px-10 py-8 text-white/40">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading team...
      </div>
    );
  }

  return (
    <div className="w-full min-h-full bg-slate-950 px-6 md:px-10 py-8">
      <div className="max-w-2xl space-y-8">

        {/* Invite */}
        <div>
          <h1 className="text-lg font-semibold mb-1">Team</h1>
          <p className="text-xs text-white/40 mb-5">Invite members and assign them to this project.</p>
          <form onSubmit={invite} className="bg-white/[0.03] border border-white/10 rounded-xl p-4 space-y-3">
            <h2 className="text-sm font-medium text-white/80">Invite to organization</h2>
            <div className="flex gap-2">
              <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@company.com" required
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors" />
              <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as "employee" | "manager")}
                className="bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-blue-500">
                <option value="employee">Employee</option>
                <option value="manager">Manager</option>
              </select>
              <button type="submit" disabled={inviting}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 px-3 py-2 rounded-lg text-sm font-medium transition-colors">
                {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Invite
              </button>
            </div>
            {inviteSuccess && <p className="flex items-center gap-1.5 text-xs text-emerald-400"><CheckCircle className="h-3.5 w-3.5" /> Invite sent</p>}
            {inviteError && <p className="text-xs text-red-400">{inviteError}</p>}
          </form>
        </div>

        {/* Assign */}
        <div>
          <h2 className="text-sm font-medium text-white/80 mb-3">Assign to this project</h2>
          {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
          {members.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 border border-dashed border-white/10 rounded-xl text-center">
              <Users className="h-8 w-8 text-white/20 mb-3" />
              <p className="text-sm text-white/40">No employees yet</p>
              <p className="text-xs text-white/25 mt-1">Invite someone above and they'll appear here.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {members.map((m) => {
                const assigned = assignedIds.has(m.user_id);
                const isActing = acting === m.user_id;
                return (
                  <div key={m.user_id} className="bg-white/[0.03] border border-white/10 rounded-xl flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">{m.name ?? "Unnamed"}</p>
                      <p className="text-xs text-white/40">{m.email}</p>
                    </div>
                    <button onClick={() => toggleAssign(m.user_id, assigned)} disabled={isActing}
                      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                        assigned
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20"
                          : "bg-white/5 text-white/50 border-white/10 hover:bg-blue-500/10 hover:text-blue-400 hover:border-blue-500/20"
                      }`}>
                      {isActing ? <Loader2 className="h-3 w-3 animate-spin" /> :
                       assigned ? <><CheckCircle className="h-3 w-3" /> Assigned</> :
                       <><UserPlus className="h-3 w-3" /> Assign</>}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
