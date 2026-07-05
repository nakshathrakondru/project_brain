"use client";

import { useEffect, useState, useRef } from "react";
import { Brain, Sparkles, Zap } from "lucide-react";

// ── Knowledge Graph Mock ───────────────────────────────────────────────────
const HERO_NODES = [
  { id: "a", x: 8,  y: 38, label: "auth/login.py",           color: "#3b82f6" },
  { id: "b", x: 44, y: 10, label: "validate_email()",         color: "#10b981" },
  { id: "c", x: 44, y: 65, label: "PR #42: Add validation",  color: "#f59e0b" },
  { id: "d", x: 78, y: 38, label: "Subscriber Model",         color: "#8b5cf6" },
  { id: "e", x: 25, y: 85, label: "omprakash8639",            color: "#06b6d4" },
  { id: "f", x: 62, y: 85, label: "Issue #17: Invalid email", color: "#ef4444" },
];
const HERO_EDGES = [
  { from: "a", to: "b" }, { from: "a", to: "c" },
  { from: "b", to: "d" }, { from: "c", to: "d" },
  { from: "e", to: "a" }, { from: "c", to: "f" },
];

export function GraphPanel() {
  const nodeMap = Object.fromEntries(HERO_NODES.map(n => [n.id, n]));
  return (
    <div className="rounded-xl border border-white/15 bg-slate-900/90 backdrop-blur-sm p-5 shadow-xl">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-xs text-white/50 font-medium uppercase tracking-wider">Knowledge Graph</span>
      </div>
      <div className="relative w-full" style={{ height: 200 }}>
        <svg className="absolute inset-0 w-full h-full overflow-visible">
          <style>{`
            .marching { stroke-dasharray: 5 5; animation: march 8s linear infinite; }
            @keyframes march { to { stroke-dashoffset: -60; } }
            @media (prefers-reduced-motion: reduce) { .marching { animation: none; } }
          `}</style>
          {HERO_EDGES.map((e, i) => {
            const from = nodeMap[e.from], to = nodeMap[e.to];
            if (!from || !to) return null;
            return (
              <line key={i} className="marching"
                x1={`${from.x}%`} y1={`${from.y}%`}
                x2={`${to.x}%`}   y2={`${to.y}%`}
                stroke="rgba(99,130,220,0.35)" strokeWidth="1.5" />
            );
          })}
        </svg>
        {HERO_NODES.map(n => (
          <div key={n.id} className="absolute flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border shadow-md"
            style={{
              left: `${n.x}%`, top: `${n.y}%`,
              transform: "translate(-50%, -50%)",
              background: `${n.color}18`, borderColor: `${n.color}50`,
              color: n.color, whiteSpace: "nowrap", backdropFilter: "blur(4px)",
            }}>
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: n.color }} />
            {n.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── AI Tech Lead Demo Panel ────────────────────────────────────────────────
const ANSWER = "Redis was added in PR #38 by @nakshathrakondru for session caching — the login latency was too high without it. See auth/session.py.";

export function ChatPanel() {
  const [displayed, setDisplayed] = useState("");
  const [started, setStarted] = useState(false);
  const iRef = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setStarted(true), 900);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!started) return;
    if (iRef.current >= ANSWER.length) return;
    const reducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) { setDisplayed(ANSWER); return; }
    const timer = setInterval(() => {
      iRef.current += 1;
      setDisplayed(ANSWER.slice(0, iRef.current));
      if (iRef.current >= ANSWER.length) clearInterval(timer);
    }, 18);
    return () => clearInterval(timer);
  }, [started]);

  return (
    <div className="rounded-xl border border-white/15 bg-slate-900/90 backdrop-blur-sm overflow-hidden shadow-xl">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/10 bg-white/[0.03]">
        <Brain className="h-3.5 w-3.5 text-blue-400" />
        <span className="text-xs font-medium text-white/60">AI Tech Lead</span>
        <div className="ml-auto flex gap-1">
          <div className="w-2 h-2 rounded-full bg-red-500/50" />
          <div className="w-2 h-2 rounded-full bg-amber-500/50" />
          <div className="w-2 h-2 rounded-full bg-emerald-500/50" />
        </div>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex justify-end">
          <div className="bg-blue-600/20 border border-blue-500/25 rounded-xl rounded-tr-sm px-3 py-2 text-xs text-blue-200 max-w-xs">
            Why was Redis added to this project?
          </div>
        </div>
        {started && (
          <div className="flex gap-2">
            <div className="h-6 w-6 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-md">
              <Brain className="h-3 w-3" />
            </div>
            <div className="bg-white/[0.06] border border-white/12 rounded-xl rounded-tl-sm px-3 py-2 text-xs text-white/75 max-w-xs leading-relaxed min-h-[2.5rem]">
              {displayed}
              {displayed.length < ANSWER.length && (
                <span className="inline-block w-0.5 h-3 bg-blue-400 ml-0.5 animate-pulse align-middle" />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Shared Memory Panel — Two Developers, One Memory ──────────────────────
// Timeline of events shown in sequence
const EVENTS = [
  {
    dev: "Priya",
    initials: "P",
    color: "#8b5cf6",
    file: "auth/login.py",
    action: "Added email validation to login form",
    time: "10:24 AM",
    isWrite: true,
  },
  {
    dev: "Dev",
    initials: "D",
    color: "#3b82f6",
    file: "checkout/payment.py",
    action: "Agent prompt: add input sanitization",
    time: "11:02 AM",
    isWrite: false,
  },
];

const DEV_MEMORY_RESPONSE = "auth/login.py already validates email format using validate_email() — use the same pattern here for consistency.";

export function SharedMemoryPanel() {
  const [toastVisible, setToastVisible] = useState(false);
  const [devResponseVisible, setDevResponseVisible] = useState(false);
  const [devDisplayed, setDevDisplayed] = useState("");
  const iRef = useRef(0);
  const reducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Sequence: Priya writes → toast appears → Dev's AI responds
  useEffect(() => {
    const t1 = setTimeout(() => setToastVisible(true), 1200);
    const t2 = setTimeout(() => setDevResponseVisible(true), 2400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // Typewriter for dev AI response
  useEffect(() => {
    if (!devResponseVisible) return;
    if (reducedMotion) { setDevDisplayed(DEV_MEMORY_RESPONSE); return; }
    const timer = setInterval(() => {
      iRef.current += 1;
      setDevDisplayed(DEV_MEMORY_RESPONSE.slice(0, iRef.current));
      if (iRef.current >= DEV_MEMORY_RESPONSE.length) clearInterval(timer);
    }, 22);
    return () => clearInterval(timer);
  }, [devResponseVisible]);

  return (
    <div className="rounded-xl border border-white/15 bg-slate-900/90 backdrop-blur-sm overflow-hidden shadow-xl">
      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-3 border-b border-white/10 bg-white/[0.03]">
        <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
        <span className="text-xs text-white/50 font-medium uppercase tracking-wider">Shared Memory</span>
        <span className="ml-auto text-xs text-white/25">2 developers · 1 memory</span>
      </div>

      <div className="p-5">
        <div className="grid grid-cols-2 gap-4 relative">

          {/* ── Priya's panel ── */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ background: "#8b5cf620", color: "#8b5cf6", border: "1px solid #8b5cf640" }}>P</div>
              <div>
                <p className="text-xs font-medium text-white/80">Priya</p>
                <p className="text-xs text-white/35">auth/login.py</p>
              </div>
            </div>

            {/* Priya's agent action */}
            <div className="bg-white/[0.04] border border-white/10 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Sparkles className="h-3 w-3 text-purple-400" />
                <span className="text-xs text-purple-400 font-medium">Agent edit</span>
              </div>
              <p className="text-xs text-white/60 leading-relaxed">
                Added email validation to login form
              </p>
              <div className="mt-2 flex items-center gap-1.5">
                <span className="text-xs text-white/20">10:24 AM</span>
                <span className="ml-auto flex items-center gap-1 text-xs text-purple-400">
                  <span className="w-1 h-1 rounded-full bg-purple-400 animate-pulse" />
                  Written to memory
                </span>
              </div>
            </div>
          </div>

          {/* ── Centre: shared memory glow ── */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{ zIndex: 2 }}>
            {/* Connecting lines from both sides */}
            <svg width="60" height="60" style={{ overflow: "visible" }}>
              <style>{`
                .pulse-line { stroke-dasharray: 3 4; animation: flow 2s linear infinite; }
                @keyframes flow { to { stroke-dashoffset: -28; } }
                @media (prefers-reduced-motion: reduce) { .pulse-line { animation: none; } }
              `}</style>
              <line className="pulse-line" x1="-60" y1="30" x2="30" y2="30" stroke="rgba(139,92,246,0.4)" strokeWidth="1.5" />
              <line className="pulse-line" x1="30" y1="30" x2="120" y2="30" stroke="rgba(59,130,246,0.4)" strokeWidth="1.5" />
              {/* Central node — the shared memory */}
              <circle cx="30" cy="30" r="12" fill="rgba(99,120,230,0.12)" stroke="rgba(99,120,230,0.4)" strokeWidth="1" />
              <circle cx="30" cy="30" r="6" fill="rgba(99,120,230,0.35)" />
            </svg>
          </div>

          {/* ── Dev's panel ── */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ background: "#3b82f620", color: "#3b82f6", border: "1px solid #3b82f640" }}>D</div>
              <div>
                <p className="text-xs font-medium text-white/80">Dev</p>
                <p className="text-xs text-white/35">checkout/payment.py</p>
              </div>
            </div>

            {/* Dev's agent panel */}
            <div className="bg-white/[0.04] border border-white/10 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Brain className="h-3 w-3 text-blue-400" />
                <span className="text-xs text-blue-400 font-medium">AI knows</span>
                {/* Toast notification */}
                {toastVisible && (
                  <span className="ml-auto flex items-center gap-1 text-xs text-emerald-400 animate-fade-in">
                    <Zap className="h-2.5 w-2.5" />
                    memory updated
                  </span>
                )}
              </div>
              {devResponseVisible ? (
                <p className="text-xs text-white/60 leading-relaxed min-h-[2.5rem]">
                  {devDisplayed}
                  {devDisplayed.length < DEV_MEMORY_RESPONSE.length && (
                    <span className="inline-block w-0.5 h-3 bg-blue-400 ml-0.5 animate-pulse align-middle" />
                  )}
                </p>
              ) : (
                <div className="space-y-1.5 min-h-[2.5rem]">
                  <div className="h-2 bg-white/8 rounded animate-pulse w-full" />
                  <div className="h-2 bg-white/8 rounded animate-pulse w-3/4" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Caption */}
        <p className="text-xs text-white/30 text-center mt-4 leading-relaxed italic">
          Priya adds validation. An hour later, Dev's AI already knows — same conventions, no re-explaining.
        </p>
      </div>
    </div>
  );
}
