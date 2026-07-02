"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Loader2, GitMerge, MessageSquare, CheckSquare, Download } from "lucide-react";

interface TimelineEvent {
  id: string;
  type: string;
  title: string;
  description: string | null;
  timestamp: string;
  metadata: Record<string, unknown>;
}

const EVENT_ICONS: Record<string, React.ReactNode> = {
  ingestion: <Download className="h-4 w-4 text-blue-400" />,
  task_created: <CheckSquare className="h-4 w-4 text-emerald-400" />,
  conversation: <MessageSquare className="h-4 w-4 text-violet-400" />,
};

export default function TimelinePage({ params }: { params: { id: string } }) {
  const { getToken } = useAuth();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/projects/${params.id}/timeline`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) setEvents(await res.json());
      setLoading(false);
    })();
  }, []);

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="font-semibold text-lg mb-1">Timeline</h1>
      <p className="text-xs text-white/40 mb-8">Chronological feed of project memory events</p>

      {loading ? (
        <div className="flex items-center gap-2 text-white/40">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading...
        </div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 top-0 bottom-0 w-px bg-white/10" />

          <div className="space-y-4 pl-10">
            {events.map((e) => (
              <div key={e.id} className="relative">
                {/* Dot */}
                <div className="absolute -left-6 top-2 h-4 w-4 rounded-full bg-slate-900 border border-white/20 flex items-center justify-center">
                  {EVENT_ICONS[e.type] ?? <div className="h-2 w-2 rounded-full bg-white/30" />}
                </div>

                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <p className="text-sm font-medium">{e.title}</p>
                    <span className="text-xs text-white/30 whitespace-nowrap flex-shrink-0">
                      {new Date(e.timestamp).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  {e.description && (
                    <p className="text-xs text-white/40 line-clamp-2">{e.description}</p>
                  )}
                </div>
              </div>
            ))}

            {events.length === 0 && (
              <p className="text-white/30 text-sm">No events yet. Run ingestion to populate the timeline.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
