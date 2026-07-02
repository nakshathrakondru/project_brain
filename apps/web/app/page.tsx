import Link from "next/link";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { Brain, GitBranch, Search, Zap } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white">
      <nav className="flex items-center justify-between px-8 py-5 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Brain className="h-6 w-6 text-blue-400" />
          <span className="font-semibold text-lg">Project Brain</span>
        </div>
        <div className="flex items-center gap-3">
          <SignedOut>
            <Link
              href="/sign-in"
              className="text-sm text-white/70 hover:text-white transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="text-sm bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-md transition-colors"
            >
              Get started
            </Link>
          </SignedOut>
          <SignedIn>
            <Link
              href="/dashboard"
              className="text-sm bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-md transition-colors"
            >
              Dashboard →
            </Link>
          </SignedIn>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-8 py-24 text-center">
        <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-1.5 text-sm text-blue-300 mb-8">
          <Zap className="h-3.5 w-3.5" />
          Powered by Cognee knowledge graph
        </div>

        <h1 className="text-5xl font-bold mb-6 leading-tight">
          The memory layer for
          <br />
          <span className="text-blue-400">your software projects</span>
        </h1>

        <p className="text-xl text-white/60 mb-12 max-w-2xl mx-auto">
          Connect a GitHub repo. Project Brain builds a structured knowledge graph
          of everything that happened and why — then lets your team query it with
          natural language.
        </p>

        <div className="flex items-center justify-center gap-4 mb-20">
          <Link
            href="/sign-up"
            className="bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Start for free
          </Link>
          <Link
            href="/sign-in"
            className="border border-white/20 hover:border-white/40 px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Sign in
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          {[
            {
              icon: <Brain className="h-5 w-5 text-blue-400" />,
              title: "AI Tech Lead",
              desc: "Ask anything about your codebase. Get grounded answers from your project's memory — not hallucinated guesses.",
            },
            {
              icon: <GitBranch className="h-5 w-5 text-violet-400" />,
              title: "Knowledge Graph",
              desc: "See how files, modules, PRs, decisions, and developers connect in a live, explorable graph.",
            },
            {
              icon: <Search className="h-5 w-5 text-emerald-400" />,
              title: "Smart Search",
              desc: "Semantic search over your entire project history — find the decision, not just the keyword.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/8 transition-colors"
            >
              <div className="mb-3">{f.icon}</div>
              <h3 className="font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-white/50">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
