"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Search, Loader2 } from "lucide-react";

interface SearchResult {
  node_id: string;
  node_type: string;
  title: string;
  snippet: string;
  score: number | null;
}

const NODE_TYPE_COLORS: Record<string, string> = {
  File: "text-blue-400 bg-blue-500/10",
  Module: "text-violet-400 bg-violet-500/10",
  PullRequest: "text-amber-400 bg-amber-500/10",
  Issue: "text-red-400 bg-red-500/10",
  Developer: "text-cyan-400 bg-cyan-500/10",
  Decision: "text-pink-400 bg-pink-500/10",
  Document: "text-slate-400 bg-slate-500/10",
};

export default function SearchPage({ params }: { params: { id: string } }) {
  const { getToken } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const doSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    const token = await getToken();
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/v1/projects/${params.id}/search?q=${encodeURIComponent(query)}&limit=15`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (res.ok) {
      const data = await res.json();
      setResults(data.results);
    }
    setLoading(false);
  };

  return (
    <div className="w-full px-6 md:px-10 py-8">
      <div className="mb-6">
        <h1 className="font-semibold text-lg">Smart Search</h1>
        <p className="text-xs text-white/40 mt-0.5">Semantic search over your project's knowledge graph</p>
      </div>

      <div className="flex gap-2 mb-6 max-w-2xl">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doSearch()}
            placeholder="Search files, decisions, PRs, contributors..."
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
        <button
          onClick={doSearch}
          disabled={loading || !query.trim()}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 px-5 py-3 rounded-xl text-sm font-medium transition-colors"
        >
          Search
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-white/40">
          <Loader2 className="h-4 w-4 animate-spin" />
          Searching memory...
        </div>
      )}

      {searched && !loading && results.length === 0 && (
        <p className="text-white/40 text-sm">No results found for "{query}"</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {results.map((r) => (
          <div
            key={r.node_id}
            className="bg-white/5 border border-white/10 rounded-xl p-4 hover:border-white/20 transition-colors"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-xs px-2 py-0.5 rounded-full ${NODE_TYPE_COLORS[r.node_type] ?? "bg-white/5 text-white/40"}`}>
                {r.node_type}
              </span>
              <h3 className="text-sm font-medium">{r.title}</h3>
              {r.score !== null && (
                <span className="ml-auto text-xs text-white/30">{(r.score * 100).toFixed(0)}%</span>
              )}
            </div>
            <p className="text-xs text-white/50 leading-relaxed line-clamp-3">{r.snippet}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
