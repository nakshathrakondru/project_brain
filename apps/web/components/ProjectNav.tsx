"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Brain, MessageSquare, Search, Network, Clock,
  Users, BarChart3, Settings, Ticket, Code2,
  PanelLeftOpen, PanelLeftClose, X
} from "lucide-react";

const navItems = [
  { href: "", label: "Overview", icon: Brain },
  { href: "/editor", label: "Code Editor", icon: Code2 },
  { href: "/ask", label: "AI Tech Lead", icon: MessageSquare },
  { href: "/search", label: "Search", icon: Search },
  { href: "/tickets", label: "Tickets", icon: Ticket },
  { href: "/graph", label: "Graph", icon: Network },
  { href: "/timeline", label: "Timeline", icon: Clock },
  { href: "/onboarding", label: "Onboarding", icon: Users },
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/team", label: "Team", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

// Pages that get focused mode (nav hidden by default)
const FOCUSED_PATHS = ["/editor", "/ask"];

interface Props {
  projectId: string;
}

export default function ProjectNav({ projectId }: Props) {
  const pathname = usePathname();

  // Determine if current page uses focused mode
  const isFocused = FOCUSED_PATHS.some(p =>
    pathname === `/projects/${projectId}${p}`
  );

  const [navOpen, setNavOpen] = useState(!isFocused);

  // Reset nav state when route changes
  useEffect(() => {
    setNavOpen(!isFocused);
  }, [pathname, isFocused]);

  // Close overlay on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFocused && navOpen) setNavOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isFocused, navOpen]);

  // ── Focused mode: logo + toggle button only, nav as overlay ──────────────
  if (isFocused) {
    return (
      <>
        {/* Thin focused-mode strip — logo + toggle */}
        <div className="w-10 flex-shrink-0 border-r border-white/10 flex flex-col items-center py-3 gap-4 bg-slate-950">
          <Link href="/dashboard" className="text-blue-400 hover:text-blue-300 transition-colors" title="Mycelium">
            <Brain className="h-5 w-5" />
          </Link>
          <button
            onClick={() => setNavOpen(true)}
            className="text-white/30 hover:text-white/70 transition-colors"
            title="Open navigation (N)"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        </div>

        {/* Overlay nav */}
        {navOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
              onClick={() => setNavOpen(false)}
            />
            {/* Slide-in panel */}
            <div className="fixed left-0 top-0 bottom-0 z-50 w-56 bg-slate-900 border-r border-white/10 flex flex-col shadow-2xl animate-slide-in">
              <div className="px-4 py-5 border-b border-white/10 flex items-center justify-between">
                <Link
                  href="/dashboard"
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                  onClick={() => setNavOpen(false)}
                >
                  <Brain className="h-5 w-5 text-blue-400" />
                  <span className="font-semibold text-sm text-white">Mycelium</span>
                </Link>
                <button onClick={() => setNavOpen(false)} className="text-white/30 hover:text-white/70 transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
                {navItems.map(({ href, label, icon: Icon }) => {
                  const fullPath = `/projects/${projectId}${href}`;
                  const isActive = pathname === fullPath;
                  return (
                    <Link
                      key={href}
                      href={fullPath}
                      onClick={() => setNavOpen(false)}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                        isActive
                          ? "bg-blue-600/20 text-blue-300"
                          : "text-white/60 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </>
        )}
      </>
    );
  }

  // ── Standard mode: persistent sidebar ────────────────────────────────────
  return (
    <aside className="w-56 flex-shrink-0 border-r border-white/10 flex flex-col bg-slate-950">
      <div className="px-4 py-5 border-b border-white/10">
        <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <Brain className="h-5 w-5 text-blue-400" />
          <span className="font-semibold text-sm">Mycelium</span>
        </Link>
      </div>
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const fullPath = `/projects/${projectId}${href}`;
          const isActive = pathname === fullPath;
          return (
            <Link
              key={href}
              href={fullPath}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? "bg-blue-600/20 text-blue-300"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
