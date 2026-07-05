"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  Loader2, ChevronRight, ChevronDown, File, Folder,
  Save, AlertCircle, CheckCircle, Send, Sparkles, X, Plus, Trash2
} from "lucide-react";
import dynamic from "next/dynamic";
import { apiFetchSafe, type Ticket } from "@/lib/api";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

const DEFAULT_ORG_ID = process.env.NEXT_PUBLIC_DEFAULT_ORG_ID ?? "";

interface FileNode { name: string; path: string; type: "file" | "directory"; size?: number; children?: FileNode[]; }
interface OpenFile { path: string; content: string; language: string; isDirty: boolean; }
interface AgentMessage { role: "user" | "agent"; text: string; diffSummary?: string; ticketProgress?: number; writtenToMemory?: boolean; }
interface AgentSession { id: string; title: string; updated_at: string; }

function FileTreeNode({ node, depth, onSelect, selectedPath }: { node: FileNode; depth: number; onSelect: (n: FileNode) => void; selectedPath: string | null; }) {
  const [expanded, setExpanded] = useState(depth < 2);
  if (node.type === "directory") {
    return (
      <div>
        <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1 w-full text-left px-2 py-0.5 hover:bg-white/5 rounded text-xs text-white/50 hover:text-white/80 transition-colors" style={{ paddingLeft: `${8 + depth * 12}px` }}>
          {expanded ? <ChevronDown className="h-3 w-3 flex-shrink-0" /> : <ChevronRight className="h-3 w-3 flex-shrink-0" />}
          <Folder className="h-3 w-3 flex-shrink-0 text-blue-400/70" />
          <span className="truncate">{node.name}</span>
        </button>
        {expanded && node.children?.map((c) => <FileTreeNode key={c.path} node={c} depth={depth + 1} onSelect={onSelect} selectedPath={selectedPath} />)}
      </div>
    );
  }
  return (
    <button onClick={() => onSelect(node)} className={`flex items-center gap-1.5 w-full text-left px-2 py-0.5 rounded text-xs transition-colors ${selectedPath === node.path ? "bg-blue-600/20 text-blue-300" : "hover:bg-white/5 text-white/40 hover:text-white/70"}`} style={{ paddingLeft: `${8 + depth * 12}px` }}>
      <File className="h-3 w-3 flex-shrink-0 text-white/20" />
      <span className="truncate">{node.name}</span>
    </button>
  );
}

export default function EditorPage({ params }: { params: { id: string } }) {
  const { getToken } = useAuth();

  // File tree
  const [tree, setTree] = useState<FileNode[]>([]);
  const [treeLoading, setTreeLoading] = useState(true);
  const [treeError, setTreeError] = useState<string | null>(null);
  const [openFile, setOpenFile] = useState<OpenFile | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // Agent panel
  const [agentOpen, setAgentOpen] = useState(true);
  const [agentPrompt, setAgentPrompt] = useState("");
  const [agentRunning, setAgentRunning] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<string>("");

  // Sessions
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionMessages, setSessionMessages] = useState<Record<string, AgentMessage[]>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeMessages = activeSessionId ? (sessionMessages[activeSessionId] ?? []) : [];

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [activeMessages]);

  // Load file tree
  useEffect(() => {
    (async () => {
      const token = await getToken() ?? "";
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/projects/${params.id}/editor/tree`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { setTreeError((await res.json().catch(() => ({}))).detail ?? "Could not load file tree"); setTreeLoading(false); return; }
      const data = await res.json();
      setTree(data.tree ?? []);
      setTreeLoading(false);
    })();
  }, [params.id]);

  // Load tickets + sessions (guard against double-run in dev)
  const initDone = useRef(false);
  useEffect(() => {
    if (initDone.current) return;
    initDone.current = true;
    (async () => {
      const token = await getToken() ?? "";
      const [t, s] = await Promise.all([
        apiFetchSafe<Ticket[]>(`/projects/${params.id}/tickets`, token, []),
        apiFetchSafe<AgentSession[]>(`/projects/${params.id}/agent-sessions`, token, []),
      ]);
      setTickets(t);
      setSessions(s);
      if (s.length > 0) {
        setActiveSessionId(s[0].id);
        loadSessionHistory(s[0].id, token);
      } else {
        createSession(token);
      }
    })();
  }, [params.id]);

  const loadSessionHistory = async (sessionId: string, token: string) => {
    const msgs = await apiFetchSafe<any[]>(`/projects/${params.id}/agent-sessions/${sessionId}/messages`, token, []);
    const parsed: AgentMessage[] = msgs.map((m) => ({
      role: m.role as "user" | "agent",
      text: m.content,
      writtenToMemory: m.written_to_memory,
      ticketProgress: m.ticket_progress,
    }));
    setSessionMessages(prev => ({ ...prev, [sessionId]: parsed }));
  };

  const createSession = async (token?: string) => {
    const t = token ?? await getToken() ?? "";
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/projects/${params.id}/agent-sessions`, { method: "POST", headers: { Authorization: `Bearer ${t}` } });
    if (!res.ok) return;
    const s: AgentSession = await res.json();
    setSessions(prev => [s, ...prev]);
    setActiveSessionId(s.id);
    setSessionMessages(prev => ({ ...prev, [s.id]: [] }));
    return s;
  };

  const deleteSession = async (sessionId: string) => {
    const token = await getToken() ?? "";
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/projects/${params.id}/agent-sessions/${sessionId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    setSessionMessages(prev => { const n = { ...prev }; delete n[sessionId]; return n; });
    if (activeSessionId === sessionId) {
      const remaining = sessions.filter(s => s.id !== sessionId);
      if (remaining.length > 0) { setActiveSessionId(remaining[0].id); }
      else { createSession(); }
    }
  };

  const switchSession = async (sessionId: string) => {
    setActiveSessionId(sessionId);
    if (!sessionMessages[sessionId]) {
      const token = await getToken() ?? "";
      await loadSessionHistory(sessionId, token);
    }
  };

  const saveMessage = async (sessionId: string, role: string, content: string, extras: any = {}) => {
    const token = await getToken() ?? "";
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/projects/${params.id}/agent-sessions/${sessionId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ role, content, ...extras, created_at: new Date().toISOString() }),
    });
    // Update session title if first user message
    if (role === "user") {
      setSessions(prev => prev.map(s => s.id === sessionId && s.title === "New session" ? { ...s, title: content.slice(0, 40) } : s));
    }
  };

  const openFileInEditor = useCallback(async (node: FileNode) => {
    if (node.type !== "file") return;
    setFileLoading(true);
    const token = await getToken() ?? "";
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/projects/${params.id}/editor/file?path=${encodeURIComponent(node.path)}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) { setFileLoading(false); return; }
    const data = await res.json();
    setOpenFile({ path: data.path, content: data.content, language: data.language, isDirty: false });
    setFileLoading(false);
    setSaveStatus("idle");
  }, [getToken, params.id]);

  const handleEditorChange = (value: string | undefined) => {
    if (!openFile || value === undefined) return;
    setOpenFile(prev => prev ? { ...prev, content: value, isDirty: true } : null);
    setSaveStatus("idle");
  };

  const saveFile = useCallback(async () => {
    if (!openFile || !openFile.isDirty) return;
    setSaveStatus("saving");
    try {
      const token = await getToken() ?? "";
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/projects/${params.id}/editor/file?path=${encodeURIComponent(openFile.path)}`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ content: openFile.content }) });
      if (!res.ok) throw new Error("Save failed");
      setOpenFile(prev => prev ? { ...prev, isDirty: false } : null);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch { setSaveStatus("error"); }
  }, [openFile, getToken, params.id]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); saveFile(); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [saveFile]);

  const runAgent = async () => {
    if (!agentPrompt.trim() || !openFile || agentRunning || !activeSessionId) return;
    const prompt = agentPrompt.trim();
    setAgentPrompt("");
    setAgentRunning(true);

    const userMsg: AgentMessage = { role: "user", text: prompt };
    setSessionMessages(prev => ({ ...prev, [activeSessionId]: [...(prev[activeSessionId] ?? []), userMsg] }));
    await saveMessage(activeSessionId, "user", prompt);

    try {
      const token = await getToken() ?? "";
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/projects/${params.id}/agent/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ prompt, file_path: openFile.path, ticket_id: selectedTicket || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Agent failed");

      setOpenFile(prev => prev ? { ...prev, content: data.updated_content, isDirty: false } : null);

      const agentMsg: AgentMessage = {
        role: "agent",
        text: `Done. ${data.diff_summary}`,
        writtenToMemory: data.written_to_memory,
        ticketProgress: data.ticket_progress,
      };
      setSessionMessages(prev => ({ ...prev, [activeSessionId]: [...(prev[activeSessionId] ?? []), agentMsg] }));
      await saveMessage(activeSessionId, "agent", agentMsg.text, {
        file_path: openFile.path,
        written_to_memory: data.written_to_memory,
        ticket_progress: data.ticket_progress,
      });
    } catch (e) {
      const errMsg: AgentMessage = { role: "agent", text: `Error: ${e instanceof Error ? e.message : "Something went wrong"}` };
      setSessionMessages(prev => ({ ...prev, [activeSessionId]: [...(prev[activeSessionId] ?? []), errMsg] }));
    } finally {
      setAgentRunning(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 text-white overflow-hidden">
      {/* File Tree */}
      <div className="w-52 flex-shrink-0 border-r border-white/10 flex flex-col">
        <div className="px-3 py-2 border-b border-white/10">
          <p className="text-xs font-medium text-white/40 uppercase tracking-wider">Explorer</p>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {treeLoading ? <div className="flex items-center gap-2 px-3 py-4 text-white/30 text-xs"><Loader2 className="h-3 w-3 animate-spin" /> Loading...</div>
            : treeError ? <div className="px-3 py-4 text-red-400 text-xs"><AlertCircle className="h-4 w-4 mb-1" />{treeError}</div>
            : tree.map(n => <FileTreeNode key={n.path} node={n} depth={0} onSelect={openFileInEditor} selectedPath={openFile?.path ?? null} />)}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Tab bar */}
        <div className="flex items-center border-b border-white/10 h-9 bg-slate-900/50 flex-shrink-0">
          {openFile ? (
            <div className="flex items-center gap-2 px-4 py-1 border-r border-white/10 bg-slate-950/50">
              <File className="h-3.5 w-3.5 text-white/40" />
              <span className="text-xs text-white/70">{openFile.path.split("/").pop()}</span>
              {openFile.isDirty && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
            </div>
          ) : <span className="px-4 text-xs text-white/20">Select a file</span>}
          <div className="ml-auto flex items-center gap-2 px-3">
            {openFile && (
              <button onClick={saveFile} disabled={!openFile.isDirty || saveStatus === "saving"} className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                {saveStatus === "saving" ? <Loader2 className="h-3 w-3 animate-spin" /> : saveStatus === "saved" ? <CheckCircle className="h-3 w-3 text-emerald-400" /> : <Save className="h-3 w-3" />}
                {saveStatus === "saved" ? "Saved" : saveStatus === "saving" ? "Saving..." : "Save"}
              </button>
            )}
            <button onClick={() => setAgentOpen(!agentOpen)} className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded transition-colors ${agentOpen ? "bg-blue-600/20 text-blue-400 border border-blue-500/30" : "bg-white/5 text-white/40 hover:bg-white/10"}`}>
              <Sparkles className="h-3 w-3" /> AI Agent
            </button>
          </div>
        </div>

        <div className="flex-1 flex min-h-0">
          {/* Monaco */}
          <div className="flex-1 relative">
            {fileLoading && <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 z-10"><Loader2 className="h-5 w-5 animate-spin text-white/40" /></div>}
            {openFile ? (
              <MonacoEditor height="100%" language={openFile.language} value={openFile.content} onChange={handleEditorChange} theme="vs-dark"
                options={{ fontSize: 13, fontFamily: "'JetBrains Mono', Consolas, monospace", minimap: { enabled: false }, scrollBeyondLastLine: false, wordWrap: "off", lineNumbers: "on", tabSize: 2, insertSpaces: true, automaticLayout: true, padding: { top: 8 } }} />
            ) : (
              <div className="flex items-center justify-center h-full text-white/20">
                <div className="text-center"><File className="h-12 w-12 mx-auto mb-3 opacity-20" /><p className="text-sm">Select a file from the explorer</p></div>
              </div>
            )}
          </div>

          {/* Agent Panel */}
          {agentOpen && (
            <div className="w-80 flex-shrink-0 border-l border-white/10 flex flex-col bg-slate-900/30">
              {/* Session tabs — Kiro style */}
              <div className="border-b border-white/10">
                <div className="flex items-center gap-1 px-2 pt-1 overflow-x-auto">
                  {sessions.map(s => (
                    <div key={s.id} onClick={() => switchSession(s.id)}
                      className={`group flex items-center gap-1.5 px-2.5 py-1 rounded-t text-xs cursor-pointer transition-colors flex-shrink-0 ${activeSessionId === s.id ? "bg-slate-800 text-white border-t border-l border-r border-white/10" : "text-white/40 hover:text-white/70 hover:bg-white/5"}`}>
                      <span className="max-w-20 truncate">{s.title}</span>
                      <button onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }} className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all ml-0.5">
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ))}
                  <button onClick={() => createSession()} className="p-1 text-white/30 hover:text-white/70 flex-shrink-0 transition-colors" title="New session">
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Ticket selector */}
              <div className="px-3 py-2 border-b border-white/10">
                <select value={selectedTicket} onChange={(e) => setSelectedTicket(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500">
                  <option value="">No ticket (free edit)</option>
                  {tickets.map(t => <option key={t.id} value={t.id}>#{t.id.slice(0, 6)} — {t.title.slice(0, 30)}</option>)}
                </select>
                {!openFile && <p className="text-xs text-amber-400/70 mt-1.5">Open a file first</p>}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {activeMessages.length === 0 && (
                  <div className="text-center py-6">
                    <Sparkles className="h-6 w-6 text-blue-400/30 mx-auto mb-2" />
                    <p className="text-xs text-white/30">Open a file, type what you want the AI to do.</p>
                    <div className="mt-4 space-y-1.5">
                      {["Add input validation", "Add error handling", "Add TypeScript types", "Add comments"].map(s => (
                        <button key={s} onClick={() => setAgentPrompt(s)} className="block w-full text-left text-xs text-white/30 hover:text-white/60 bg-white/3 hover:bg-white/5 px-2.5 py-1.5 rounded transition-colors">{s}</button>
                      ))}
                    </div>
                  </div>
                )}
                {activeMessages.map((m, i) => (
                  <div key={i} className={`${m.role === "user" ? "flex justify-end" : ""}`}>
                    <div className={`rounded-lg px-3 py-2 text-xs max-w-full ${m.role === "user" ? "bg-blue-600/20 text-blue-200 border border-blue-500/20" : "bg-white/5 border border-white/10 text-white/70"}`}>
                      <p className="leading-relaxed">{m.text}</p>
                      {m.ticketProgress !== undefined && m.ticketProgress !== null && (
                        <div className="mt-2 pt-2 border-t border-white/10">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-white/40">Ticket progress</span>
                            <span className="text-emerald-400 font-medium">{m.ticketProgress}%</span>
                          </div>
                          <div className="w-full bg-white/10 rounded-full h-1">
                            <div className="bg-emerald-500 h-1 rounded-full transition-all" style={{ width: `${m.ticketProgress}%` }} />
                          </div>
                        </div>
                      )}
                      {m.writtenToMemory !== undefined && (
                        <div className={`mt-1.5 text-xs ${m.writtenToMemory ? "text-purple-400" : "text-white/20"}`}>
                          {m.writtenToMemory ? "✦ Written to shared memory" : "◦ Trivial — skipped memory"}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {agentRunning && (
                  <div className="flex items-center gap-2 text-white/30 text-xs">
                    <Loader2 className="h-3 w-3 animate-spin" /> Agent is editing your file...
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-3 border-t border-white/10">
                <div className="flex gap-2">
                  <textarea value={agentPrompt} onChange={(e) => setAgentPrompt(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); runAgent(); } }}
                    placeholder={openFile ? "What should the agent do?" : "Open a file first..."}
                    disabled={!openFile || agentRunning} rows={2}
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500 resize-none disabled:opacity-40 transition-colors" />
                  <button onClick={runAgent} disabled={!openFile || !agentPrompt.trim() || agentRunning}
                    className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed px-3 rounded-lg transition-colors flex-shrink-0">
                    {agentRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-white/20 mt-1.5">Enter to send · Shift+Enter for new line</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
