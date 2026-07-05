"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Trash2, Loader2 } from "lucide-react";

interface Props {
  projectId: string;
  projectName: string;
  orgId: string;
}

export default function DeleteProjectButton({ projectId, projectName, orgId }: Props) {
  const { getToken } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!confirming) {
      setConfirming(true);
      // Auto-reset confirm state after 3s if user doesn't click again
      setTimeout(() => setConfirming(false), 3000);
      return;
    }

    setDeleting(true);
    try {
      const token = await getToken() ?? "";
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/organizations/${orgId}/projects/${projectId}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok || res.status === 204) {
        window.location.reload();
      } else {
        const body = await res.json().catch(() => ({}));
        alert(`Delete failed: ${body.detail ?? res.status}`);
        setDeleting(false);
        setConfirming(false);
      }
    } catch (err) {
      alert("Delete failed — check console");
      setDeleting(false);
      setConfirming(false);
    }
  };

  if (deleting) {
    return <Loader2 className="h-3.5 w-3.5 animate-spin text-white/30" />;
  }

  return (
    <button
      onClick={handleDelete}
      title={confirming ? `Click again to delete "${projectName}"` : `Delete project`}
      className={`flex items-center gap-1 text-xs transition-colors ${
        confirming
          ? "text-red-400 hover:text-red-300"
          : "text-white/20 hover:text-red-400"
      }`}
    >
      <Trash2 className="h-3 w-3" />
      {confirming ? "Confirm delete" : "Delete"}
    </button>
  );
}
