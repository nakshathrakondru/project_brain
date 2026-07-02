"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Play, CheckCircle, Loader2, AlertCircle, RefreshCw } from "lucide-react";

const DEFAULT_ORG_ID = process.env.NEXT_PUBLIC_DEFAULT_ORG_ID ?? "";

type IngestionStatus = "not_started" | "queued" | "in_progress" | "completed" | "failed";

export default function IngestPage({ params }: { params: { id: string } }) {
  const { getToken } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState<IngestionStatus>("not_started");
  const [filesProcessed, setFilesProcessed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  const fetchStatus = useCallback(async () => {
    const token = await getToken();
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/v1/organizations/${DEFAULT_ORG_ID}/projects/${params.id}/ingest/status`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return;
    const data = await res.json();
    setStatus(data.ingestion_status);
    if (data.latest_job) {
      setFilesProcessed(data.latest_job.files_processed ?? 0);
      if (data.latest_job.error_message) setError(data.latest_job.error_message);
    }
    return data.ingestion_status as IngestionStatus;
  }, [getToken, params.id]);

  // Poll while in progress
  useEffect(() => {
    if (!polling) return;
    const interval = setInterval(async () => {
      const s = await fetchStatus();
      if (s === "completed" || s === "failed") {
        setPolling(false);
        clearInterval(interval);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [polling, fetchStatus]);

  // Load initial status
  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const startIngestion = async () => {
    setError(null);
    const token = await getToken();
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/v1/organizations/${DEFAULT_ORG_ID}/projects/${params.id}/ingest`,
      { method: "POST", headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) {
      const data = await res.json();
      setError(data.detail ?? "Failed to start ingestion");
      return;
    }
    setStatus("queued");
    setPolling(true);
  };

  const isRunning = status === "queued" || status === "in_progress";

  return (
    <div className="p-8 max-w-lg">
      <h1 className="text-2xl font-bold mb-2">Repository Ingestion</h1>
      <p className="text-white/50 text-sm mb-8">
        Pulls files, PRs, issues, and contributors from GitHub and builds your knowledge graph.
      </p>

      {/* Status card */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          {status === "completed" && <CheckCircle className="h-6 w-6 text-emerald-500" />}
          {isRunning && <Loader2 className="h-6 w-6 text-blue-400 animate-spin" />}
          {status === "failed" && <AlertCircle className="h-6 w-6 text-red-500" />}
          {status === "not_started" && <Play className="h-6 w-6 text-white/30" />}

          <div>
            <div className="font-medium capitalize">{status.replace("_", " ")}</div>
            {filesProcessed > 0 && (
              <div className="text-xs text-white/40">{filesProcessed} files processed</div>
            )}
          </div>
        </div>

        {isRunning && (
          <div className="w-full bg-white/10 rounded-full h-1.5">
            <div className="bg-blue-500 h-1.5 rounded-full w-1/2 animate-pulse" />
          </div>
        )}

        {status === "completed" && (
          <p className="text-sm text-emerald-400">
            Knowledge graph is ready. You can now use AI Tech Lead, Search, and Graph features.
          </p>
        )}

        {error && (
          <p className="text-sm text-red-400 mt-2">{error}</p>
        )}
      </div>

      <div className="flex gap-3">
        {!isRunning && status !== "completed" && (
          <button
            onClick={startIngestion}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            <Play className="h-4 w-4" />
            Start ingestion
          </button>
        )}

        {status === "failed" && (
          <button
            onClick={startIngestion}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/15 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        )}

        {status === "completed" && (
          <button
            onClick={() => router.push(`/projects/${params.id}`)}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            <CheckCircle className="h-4 w-4" />
            Continue to project
          </button>
        )}
      </div>
    </div>
  );
}
