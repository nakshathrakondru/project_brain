"use client";

import { useEffect, useState, useCallback } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  BackgroundVariant,
} from "reactflow";
import "reactflow/dist/style.css";
import { useAuth } from "@clerk/nextjs";
import { Loader2, Network } from "lucide-react";

const NODE_COLORS: Record<string, string> = {
  File: "#3b82f6",
  Module: "#8b5cf6",
  Function: "#10b981",
  PullRequest: "#f59e0b",
  Issue: "#ef4444",
  Developer: "#06b6d4",
  Document: "#64748b",
  Decision: "#ec4899",
  Task: "#84cc16",
  Conversation: "#fb923c",
};

export default function GraphPage({ params }: { params: { id: string } }) {
  const { getToken } = useAuth();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string>("all");

  const loadGraph = useCallback(
    async (typeFilter?: string) => {
      setLoading(true);
      setError(null);
      try {
        const token = await getToken();
        const qs = typeFilter && typeFilter !== "all" ? `?node_type=${typeFilter}` : "";
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/v1/projects/${params.id}/graph${qs}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.detail ?? "Failed to load graph");
        }
        const data = await res.json();

        // Position nodes in a grid layout
        const rfNodes: Node[] = data.nodes.map((n: { id: string; type: string; label: string }, i: number) => ({
          id: n.id,
          data: { label: n.label || n.id.slice(0, 20) },
          position: {
            x: (i % 8) * 180 + Math.random() * 40,
            y: Math.floor(i / 8) * 120 + Math.random() * 20,
          },
          style: {
            background: NODE_COLORS[n.type] ?? "#475569",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            fontSize: "11px",
            padding: "8px 12px",
            maxWidth: "140px",
          },
        }));

        const rfEdges: Edge[] = data.edges.map((e: { id: string; source: string; target: string; label: string }) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          label: e.label,
          style: { stroke: "#475569", strokeWidth: 1 },
          labelStyle: { fill: "#94a3b8", fontSize: 10 },
        }));

        setNodes(rfNodes);
        setEdges(rfEdges);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load graph");
      } finally {
        setLoading(false);
      }
    },
    [getToken, params.id]
  );

  useEffect(() => { loadGraph(selectedType); }, [selectedType, loadGraph]);

  const nodeTypes = ["all", "File", "Module", "Function", "PullRequest", "Issue", "Developer", "Decision"];

  return (
    <div className="flex flex-col h-screen">
      <div className="border-b border-white/10 px-8 py-4 flex items-center justify-between">
        <div>
          <h1 className="font-semibold">Knowledge Graph</h1>
          <p className="text-xs text-white/40">{nodes.length} nodes · {edges.length} edges</p>
        </div>
        <div className="flex gap-1.5">
          {nodeTypes.map((t) => (
            <button
              key={t}
              onClick={() => setSelectedType(t)}
              className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                selectedType === t
                  ? "bg-blue-600 text-white"
                  : "bg-white/5 text-white/50 hover:bg-white/10"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 z-10">
            <div className="flex items-center gap-2 text-white/60">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading graph...
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <Network className="h-10 w-10 text-white/20 mx-auto mb-3" />
              <p className="text-white/50 text-sm">{error}</p>
            </div>
          </div>
        )}

        {!loading && !error && nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <Network className="h-10 w-10 text-white/20 mx-auto mb-3" />
              <p className="text-white/50 text-sm">No nodes found. Run ingestion first.</p>
            </div>
          </div>
        )}

        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          style={{ background: "#020817" }}
        >
          <Background variant={BackgroundVariant.Dots} color="#1e293b" />
          <Controls />
          <MiniMap
            style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)" }}
            nodeColor={(n) => (n.style?.background as string) ?? "#475569"}
          />
        </ReactFlow>
      </div>
    </div>
  );
}
