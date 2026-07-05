import Link from "next/link";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { Brain, Zap, Code2, CheckCircle, ArrowRight, ExternalLink } from "lucide-react";
import GraphBackground from "@/components/GraphBackground";
import { SharedMemoryPanel, GraphPanel, ChatPanel } from "@/components/LandingPanels";
import SecondaryProof from "@/components/SecondaryProof";

export default function HomePage() {
  return (
    <div className="relative min-h-screen bg-slate-950 text-white overflow-x-hidden">

      {/* ── Animated background ── */}
      <GraphBackground />

      <div className="relative" style={{ zIndex: 1 }}>

        {/* ── Nav ── */}
        <nav className="flex items-center justify-between px-8 py-5 border-b border-white/10 backdrop-blur-sm bg-slate-950/60">
          <div className="flex items-center gap-2">
            <Brain className="h-6 w-6 text-blue-400" />
            <span className="font-semibold text-lg tracking-tight">Mycelium</span>
          </div>
          <div className="flex items-center gap-3">
            <SignedOut>
              <Link href="/sign-in" className="text-sm text-white/60 hover:text-white transition-colors">Sign in</Link>
              <Link href="/sign-up" className="text-sm bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg transition-colors font-medium shadow-lg shadow-blue-600/20">
                Get started →
              </Link>
            </SignedOut>
            <SignedIn>
              <Link href="/dashboard" className="text-sm bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg transition-colors font-medium shadow-lg shadow-blue-600/20">
                Dashboard →
              </Link>
            </SignedIn>
          </div>
        </nav>

        {/* ── Hero ── */}
        <section className="max-w-3xl mx-auto px-8 pt-28 pb-20 text-center">
          {/* Positioning pill */}
          <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-sm text-white/50 mb-10">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            Shared AI memory for dev teams
          </div>

          {/* Headline */}
          <h1 className="text-6xl sm:text-7xl font-bold mb-4 leading-[1.05] tracking-tight">
            Your codebase<br />has memory.
            <br />
            <span className="relative inline-block">
              <span className="absolute inset-0 blur-3xl" aria-hidden="true"
                style={{ background: "radial-gradient(ellipse at center, rgba(59,130,246,0.22) 0%, transparent 70%)" }} />
              <span className="relative text-blue-400">Your AI should too.</span>
            </span>
          </h1>

          {/* Cognee credit — inline, small, right below the headline */}
          <div className="flex items-center justify-center mb-10">
            <a href="https://cognee.ai" target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-white/30 hover:text-white/55 transition-colors">
              <Zap className="h-2.5 w-2.5 text-blue-400/60" />
              Powered by <span className="text-blue-400/70 font-medium">Cognee</span>
              <ExternalLink className="h-2 w-2 opacity-40" />
            </a>
          </div>

          {/* Subhead — names the pain, then the resolution */}
          <p className="text-lg text-white/45 mb-4 max-w-xl mx-auto leading-relaxed">
            Two developers. Two AI sessions. Without shared memory, they drift —
            different conventions, duplicated work, context lost the moment a session ends.
          </p>
          <p className="text-base text-white/60 mb-12 max-w-lg mx-auto leading-relaxed font-medium">
            Mycelium gives every developer's AI one shared, growing memory of the project.
          </p>

          {/* CTAs */}
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <SignedOut>
              <Link href="/sign-up"
                className="bg-blue-600 hover:bg-blue-500 px-8 py-3.5 rounded-xl font-semibold text-sm transition-colors flex items-center gap-2 shadow-xl shadow-blue-600/25">
                Start for free <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#proof"
                className="text-sm text-white/50 hover:text-white transition-colors flex items-center gap-1.5 underline underline-offset-4 decoration-white/20 hover:decoration-white/50">
                See how it works
              </a>
            </SignedOut>
            <SignedIn>
              <Link href="/dashboard"
                className="bg-blue-600 hover:bg-blue-500 px-8 py-3.5 rounded-xl font-semibold text-sm transition-colors flex items-center gap-2 shadow-xl shadow-blue-600/25">
                Go to Dashboard <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#proof"
                className="text-sm text-white/50 hover:text-white transition-colors flex items-center gap-1.5 underline underline-offset-4 decoration-white/20 hover:decoration-white/50">
                See how it works
              </a>
            </SignedIn>
          </div>
        </section>

        {/* ── Primary proof — Shared Memory (the core value prop) ── */}
        <section id="proof" className="max-w-4xl mx-auto px-8 pb-20">
          <p className="text-xs text-white/25 uppercase tracking-[0.15em] font-medium text-center mb-8">
            The core idea
          </p>
          <SharedMemoryPanel />
        </section>

        {/* ── Secondary proof — tabbed Graph / AI Tech Lead ── */}
        <section className="max-w-4xl mx-auto px-8 pb-20">
          <p className="text-xs text-white/25 uppercase tracking-[0.15em] font-medium text-center mb-8">
            Built on top of it
          </p>
          <SecondaryProof />
        </section>

        {/* ── Feature cards — borderless, lighter treatment ── */}
        <section className="max-w-5xl mx-auto px-8 pb-36">
          <p className="text-xs text-white/25 uppercase tracking-[0.15em] font-medium text-center mb-12">
            What you get
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/[0.06] rounded-2xl overflow-hidden border border-white/[0.06]">
            {[
              {
                icon: <Brain className="h-6 w-6 text-blue-400" />,
                title: "AI Tech Lead",
                desc: "Ask anything about your codebase. Grounded in real project history shared across the whole team.",
                badge: "Q&A",
                badgeColor: "text-blue-400",
                accent: "group-hover:text-blue-400",
              },
              {
                icon: <Code2 className="h-6 w-6 text-purple-400" />,
                title: "AI Code Agent",
                desc: "Prompt the AI to edit files directly in-browser. Every change writes back to shared memory automatically.",
                badge: "New",
                badgeColor: "text-purple-400",
                accent: "group-hover:text-purple-400",
              },
              {
                icon: <CheckCircle className="h-6 w-6 text-emerald-400" />,
                title: "Live Progress",
                desc: "Ticket progress updates as the agent works. Managers see the whole team's progress in real time.",
                badge: "Dashboard",
                badgeColor: "text-emerald-400",
                accent: "group-hover:text-emerald-400",
              },
            ].map((f) => (
              <div key={f.title}
                className={`group bg-slate-950 hover:bg-white/[0.03] transition-colors px-8 py-8`}>
                <div className="mb-4">{f.icon}</div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className={`font-semibold text-white transition-colors ${f.accent}`}>{f.title}</h3>
                  <span className={`text-xs ${f.badgeColor} opacity-60`}>{f.badge}</span>
                </div>
                <p className="text-sm text-white/40 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="border-t border-white/8 px-8 py-10 text-center">
          <div className="flex items-center justify-center gap-2 text-xs text-white/20">
            <Brain className="h-3.5 w-3.5 text-blue-400/40" />
            Mycelium · Built with Cognee, Groq, and Next.js
          </div>
        </footer>

      </div>
    </div>
  );
}
