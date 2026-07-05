"use client";

import { useEffect, useState, useCallback } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  BackgroundVariant,
  Handle,
  Position,
} from "reactflow";
import "reactflow/dist/style.css";
import dagre from "dagre";
import { useAuth } from "@clerk/nextjs";
import { Loader2, Network } from "lucide-react";

// ── Node colors by type ────────────────────────────────────────────────────
const NODE_COLORS: Record<string, string> = {
  File:        "#3b82f6",
  Module:      "#8b5cf6",
  Function:    "#10b981",
  Component:   "#10b981",
  PullRequest: "#f59e0b",
  Issue:       "#ef4444",
  Developer:   "#06b6d4",
  Document:    "#64748b",
  Decision:    "#ec4899",
  Task:        "#84cc16",
  Knowledge:   "#6366f1",
};

// ── Text cleaners ──────────────────────────────────────────────────────────

/** Strip markdown: **bold**, _italic_, `code`, # headings */
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/_(.*?)_/g, "$1")
    .replace(/`(.*?)`/g, "$1")
    .replace(/^#+\s+/gm, "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .trim();
}

/** Truncate to maxLen with ellipsis */
function truncate(text: string, maxLen: number): string {
  return text.length > maxLen ? text.slice(0, maxLen - 1) + "…" : text;
}

/** Detect leaked LLM conversational reply */
const LLM_NOISE_PREFIXES = [
  "sure,", "here's", "here is", "of course", "certainly",
  "absolutely", "i can help", "happy to", "i'll help", "based on",
  "the provided context", "does not contain", "unfortunately",
];
function isLlmNoise(text: string): boolean {
  const lower = text.toLowerCase().trimStart();
  return LLM_NOISE_PREFIXES.some(p => lower.startsWith(p));
}

// ── Dagre auto-layout ──────────────────────────────────────────────────────
const NODE_WIDTH = 160;
const NODE_HEIGHT = 50;

function applyDagreLayout(nodes: Node[], edges: Edge[]): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", nodesep: 60, ranksep: 100, marginx: 40, marginy: 40 });

  nodes.forEach(n => g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT }));
  edges.forEach(e => {
    if (g.hasNode(e.source) && g.hasNode(e.target)) {
      g.setEdge(e.source, e.target);
    }
  });

  dagre.layout(g);

  return nodes.map(n => {
    const pos = g.node(n.id);
    return {
      ...n,
      position: {
        x: pos ? pos.x - NODE_WIDTH / 2 : 0,
        y: pos ? pos.y - NODE_HEIGHT / 2 : 0,
      },
    };
  });
}

// ── Custom node with tooltip ───────────────────────────────────────────────
function GraphNode({ data }: { data: { label: string; fullLabel: string; color: string } }) {
  return (
    <div
      title={data.fullLabel}
      style={{
        background: data.color,
        color: "#fff",
        borderRadius: "8px",
        padding: "8px 12px",
        fontSize: "11px",
        width: NODE_WIDTH,
        minHeight: NODE_HEIGHT,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        wordBreak: "break-word",
        lineHeight: "1.3",
        border: "1px solid rgba(255,255,255,0.15)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
        cursor: "default",
      }}
    >
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <span>{data.label}</span>
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  );
}

const nodeTypes = { graphNode: GraphNode };

// ── Main component ─────────────────────────────────────────────────────────
export default function GraphPage({ params }: { params: { id: string } }) {
  const { getToken } = useAuth();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string>("all");

  const loadGraph = useCallback(async (typeFilter?: string) => {
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

      // Clean and filter nodes
      const cleanedNodes: Node[] = [];
      for (const n of data.nodes) {
        const rawLabel: string = n.label || n.id.slice(0, 30);
        const cleaned = stripMarkdown(rawLabel);

        // Filter out leaked LLM noise
        if (isLlmNoise(cleaned)) continue;
        // Filter out very short/meaningless nodes
        if (cleaned.length < 5) continue;

        const fullLabel = cleaned;
        const displayLabel = truncate(cleaned, 45);

        cleanedNodes.push({
          id: n.id,
          type: "graphNode",
          data: {
            label: displayLabel,
            fullLabel,
            color: NODE_COLORS[n.type] ?? "#475569",
          },
          position: { x: 0, y: 0 }, // dagre will set real positions
        });
      }

      const validNodeIds = new Set(cleanedNodes.map(n => n.id));

      // Clean edges — hide "related_to" label (only one type, shown in legend)
      const cleanedEdges: Edge[] = data.edges
        .filter((e: any) => validNodeIds.has(e.source) && validNodeIds.has(e.target))
        .map((e: any) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          // No label — "related_to" is the only type, shown in legend
          style: { stroke: "#334155", strokeWidth: 1.5 },
          animated: false,
          type: "smoothstep",
        }));

      // Apply dagre layout
      const laid = applyDagreLayout(cleanedNodes, cleanedEdges);
      setNodes(laid);
      setEdges(cleanedEdges);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load graph");
    } finally {
      setLoading(false);
    }
  }, [getToken, params.id]);

  useEffect(() => { loadGraph(selectedType); }, [selectedType, loadGraph]);

  const filterTypes = ["all", "File", "Function", "Module", "Component", "PullRequest", "Issue", "Developer", "Knowledge"];

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="font-semibold text-sm">Knowledge Graph</h1>
          <p className="text-xs text-white/40 mt-0.5">
            {nodes.length} nodes · {edges.length} edges
            {nodes.length > 0 && <span className="ml-2 text-white/20">· hover nodes for full text</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Legend */}
          <div className="flex items-center gap-1.5 mr-3 text-xs text-white/30">
            <span className="w-6 h-px bg-slate-500 inline-block" />
            related_to
          </div>
          {/* Filter buttons */}
          <div className="flex gap-1">
            {filterTypes.map((t) => (
              <button
                key={t}
                onClick={() => setSelectedType(t)}
                className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                  selectedType === t
                    ? "bg-blue-600 text-white"
                    : "bg-white/5 text-white/40 hover:bg-white/10"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Graph canvas */}
      <div className="flex-1 relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 z-10">
            <div className="flex flex-col items-center gap-3 text-white/60">
              <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
              <p className="text-sm">Building knowledge graph...</p>
              <p className="text-xs text-white/30">Querying Cognee Cloud — this can take 15–30s</p>
            </div>
          </div>
        )}

        {error && !loading && (
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
              <p className="text-white/50 text-sm">No nodes found.</p>
              <p className="text-white/30 text-xs mt-1">Run ingestion first to populate the knowledge graph.</p>
            </div>
          </div>
        )}

        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.1}
          maxZoom={2}
          style={{ background: "#020817" }}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} color="#1e293b" gap={20} />
          <Controls showInteractive={false} />
          <MiniMap
            style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)" }}
            nodeColor={(n) => (n.data?.color as string) ?? "#475569"}
            maskColor="rgba(2,8,23,0.7)"
          />
        </ReactFlow>
      </div>
    </div>
  );
}
