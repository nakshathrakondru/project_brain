"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { Send, Loader2, Brain, User, Plus, Trash2, MessageSquare } from "lucide-react";
import { apiFetchSafe } from "@/lib/api";

interface Message { role: "user" | "assistant"; content: string; sources?: any[]; }
interface Session { id: string; title: string; updated_at: string; }

export default function AskPage({ params }: { params: { id: string } }) {
  const { getToken } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const loadSessions = useCallback(async () => {
    const token = await getToken() ?? "";
    const s = await apiFetchSafe<Session[]>(`/projects/${params.id}/chat-sessions`, token, []);
    setSessions(s);
    setSessionsLoading(false);
    return s;
  }, [getToken, params.id]);

  useEffect(() => {
    loadSessions().then((s) => {
      if (s.length > 0) selectSession(s[0].id);
    });
  }, []);

  const selectSession = async (sessionId: string) => {
    setActiveSession(sessionId);
    setMessages([]);
    const token = await getToken() ?? "";
    const history = await apiFetchSafe<any[]>(
      `/projects/${params.id}/chat-sessions/${sessionId}/messages`, token, []
    );
    setMessages(history.map((h) => ({
      role: h.question ? "user" : "assistant",
      content: h.question || h.answer,
    })).reduce((acc: Message[], h: any) => {
      acc.push({ role: "user", content: h.question });
      acc.push({ role: "assistant", content: h.answer });
      return acc;
    }, [] as Message[]).filter((m) => m.content));
    // Load properly
    const msgs: Message[] = [];
    for (const h of history) {
      msgs.push({ role: "user", content: h.question });
      msgs.push({ role: "assistant", content: h.answer });
    }
    setMessages(msgs);
  };

  const newSession = async () => {
    const token = await getToken() ?? "";
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/v1/projects/${params.id}/chat-sessions`,
      { method: "POST", headers: { Authorization: `Bearer ${token}` } }
    );
    const s = await res.json();
    setSessions(prev => [s, ...prev]);
    setActiveSession(s.id);
    setMessages([]);
  };

  const deleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const token = await getToken() ?? "";
    await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/v1/projects/${params.id}/chat-sessions/${sessionId}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
    );
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    if (activeSession === sessionId) {
      setActiveSession(null);
      setMessages([]);
    }
  };

  const send = async () => {
    if (!input.trim() || loading) return;
    if (!activeSession) { await newSession(); return; }

    const question = input.trim();
    setInput("");
    setMessages(m => [...m, { role: "user", content: question }]);
    setLoading(true);

    try {
      const token = await getToken() ?? "";
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/projects/${params.id}/ask`,
        { method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ question, session_id: activeSession }) }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Request failed");
      setMessages(m => [...m, { role: "assistant", content: data.answer, sources: data.sources }]);
      // Update session title in sidebar
      setSessions(prev => prev.map(s =>
        s.id === activeSession ? { ...s, title: s.title === "New chat" ? question.slice(0, 40) : s.title } : s
      ));
    } catch (err) {
      setMessages(m => [...m, { role: "assistant", content: `Error: ${err instanceof Error ? err.message : "Something went wrong"}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen">
      {/* Left sidebar — sessions */}
      <div className="w-56 flex-shrink-0 border-r border-white/10 flex flex-col bg-slate-900/30">
        <div className="p-3 border-b border-white/10">
          <button onClick={newSession}
            className="flex items-center gap-2 w-full bg-blue-600 hover:bg-blue-500 px-3 py-2 rounded-lg text-xs font-medium transition-colors">
            <Plus className="h-3.5 w-3.5" /> New chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {sessionsLoading ? (
            <div className="flex items-center gap-2 px-3 py-2 text-white/30 text-xs">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading...
            </div>
          ) : sessions.length === 0 ? (
            <p className="px-3 py-2 text-xs text-white/20">No chats yet</p>
          ) : sessions.map(s => (
            <div key={s.id}
              onClick={() => selectSession(s.id)}
              className={`group flex items-center gap-2 px-3 py-2 cursor-pointer rounded-lg mx-1 transition-colors ${
                activeSession === s.id ? "bg-white/10 text-white" : "text-white/50 hover:bg-white/5 hover:text-white/80"
              }`}>
              <MessageSquare className="h-3 w-3 flex-shrink-0" />
              <span className="text-xs truncate flex-1">{s.title}</span>
              <button onClick={(e) => deleteSession(s.id, e)}
                className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 transition-all flex-shrink-0">
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="border-b border-white/10 px-6 py-3">
          <h1 className="font-semibold text-sm">AI Tech Lead</h1>
          <p className="text-xs text-white/40">Ask anything about this project</p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {!activeSession ? (
            <div className="text-center py-16 text-white/30">
              <Brain className="h-10 w-10 mx-auto mb-4 opacity-30" />
              <p className="text-sm mb-2">Start a new chat or select one from the sidebar</p>
              <button onClick={newSession}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                + New chat
              </button>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-16 text-white/30">
              <Brain className="h-10 w-10 mx-auto mb-4 opacity-30" />
              <p className="text-sm mb-6">Ask a question to get started</p>
              <div className="flex flex-col gap-2 items-center">
                {["Why was Redis added to this project?", "What does the auth module do?", "Which files are most important?"].map(q => (
                  <button key={q} onClick={() => setInput(q)}
                    className="text-xs text-white/40 hover:text-white/70 bg-white/5 hover:bg-white/8 border border-white/10 px-4 py-2 rounded-full transition-colors">
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}>
              {m.role === "assistant" && (
                <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Brain className="h-4 w-4" />
                </div>
              )}
              <div className={`max-w-2xl ${m.role === "user" ? "order-first" : ""}`}>
                <div className={`rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === "user" ? "bg-blue-600 text-white ml-auto" : "bg-white/5 border border-white/10"
                }`}>
                  {m.content}
                </div>
                {m.role === "assistant" && m.sources && m.sources.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <p className="text-xs text-white/30 px-1">Sources</p>
                    {m.sources.slice(0, 3).map((s: any, si: number) => (
                      <div key={si} className="text-xs bg-white/3 border border-white/8 rounded-lg px-3 py-2">
                        <span className="text-blue-400">[{s.node_type}]</span>{" "}
                        <span className="text-white/60">{s.title}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {m.role === "user" && (
                <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white/40">
                Searching memory...
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-white/10 px-6 py-4">
          <div className="flex gap-3">
            <input value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
              placeholder={activeSession ? "Ask about your project..." : "Create a new chat first..."}
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors" />
            <button onClick={send} disabled={loading || !input.trim()}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-3 rounded-xl transition-colors">
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
