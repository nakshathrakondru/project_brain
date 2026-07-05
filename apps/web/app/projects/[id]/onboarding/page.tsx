"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Loader2, Users, BookOpen } from "lucide-react";

export default function OnboardingPage({ params }: { params: { id: string } }) {
  const { getToken } = useAuth();
  const [guide, setGuide] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    const token = await getToken();
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/v1/projects/${params.id}/onboarding`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (res.ok) {
      const data = await res.json();
      setGuide(data.guide);
    } else {
      const data = await res.json();
      setError(data.detail ?? "Failed to generate guide");
    }
    setLoading(false);
  };

  return (
    <div className="w-full px-6 md:px-10 py-8">
      <div className="mb-6">
        <h1 className="font-semibold text-lg">Developer Onboarding</h1>
        <p className="text-xs text-white/40 mt-0.5">
          AI-generated guide for new developers joining this project
        </p>
      </div>

      {!guide && !loading && (
        <div className="text-center py-16 border border-dashed border-white/10 rounded-xl">
          <Users className="h-10 w-10 text-white/20 mx-auto mb-4" />
          <h3 className="font-medium text-white/60 mb-2">Generate onboarding guide</h3>
          <p className="text-sm text-white/30 mb-6">
            Uses your project's knowledge graph to create a personalized onboarding doc.
          </p>
          <button
            onClick={generate}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <BookOpen className="h-4 w-4" />
            Generate guide
          </button>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-white/40 py-8">
          <Loader2 className="h-4 w-4 animate-spin" />
          Generating onboarding guide from project memory...
        </div>
      )}

      {error && (
        <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          {error}
        </div>
      )}

      {guide && (
        <div>
          <div className="prose prose-invert prose-sm max-w-none bg-white/3 border border-white/10 rounded-xl p-6">
            <pre className="whitespace-pre-wrap font-sans text-sm text-white/80 leading-relaxed">
              {guide}
            </pre>
          </div>
          <button
            onClick={generate}
            className="mt-4 text-xs text-white/30 hover:text-white/60 transition-colors"
          >
            Regenerate
          </button>
        </div>
      )}
    </div>
  );
}
