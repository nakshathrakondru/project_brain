import { Settings } from "lucide-react";

export default function SettingsPage({ params }: { params: { id: string } }) {
  return (
    <div className="p-8 max-w-lg">
      <div className="flex items-center gap-2 mb-6">
        <Settings className="h-5 w-5 text-white/40" />
        <h1 className="font-semibold text-lg">Project Settings</h1>
      </div>
      <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-white/40 text-sm">
        Settings management coming in Milestone 5.
        <br /><br />
        Project ID: <code className="text-white/60 font-mono text-xs">{params.id}</code>
      </div>
    </div>
  );
}
