"use client";

import { useState } from "react";
import { Network, MessageSquare } from "lucide-react";
import { GraphPanel, ChatPanel } from "./LandingPanels";

const TABS = [
  { id: "graph", label: "Knowledge Graph", icon: Network, desc: "The graph forms automatically as your team ingests repos and the AI agent works" },
  { id: "ask",   label: "Ask the AI",      icon: MessageSquare, desc: "Any developer can query the shared graph in plain English — no SQL, no docs diving" },
];

export default function SecondaryProof() {
  const [active, setActive] = useState<"graph" | "ask">("graph");

  return (
    <div>
      {/* Tab selector */}
      <div className="flex items-center gap-1 justify-center mb-8">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setActive(t.id as "graph" | "ask")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all ${
              active === t.id
                ? "bg-white/10 text-white border border-white/15"
                : "text-white/40 hover:text-white/70 hover:bg-white/5"
            }`}>
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Description */}
      <p className="text-sm text-white/35 text-center mb-8 max-w-md mx-auto leading-relaxed">
        {TABS.find(t => t.id === active)?.desc}
      </p>

      {/* Panel — single one at a time, generous size */}
      <div className="max-w-2xl mx-auto transition-all">
        {active === "graph" ? <GraphPanel /> : <ChatPanel />}
      </div>
    </div>
  );
}
