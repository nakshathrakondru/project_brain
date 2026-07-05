import ProjectNav from "@/components/ProjectNav";

export default function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  return (
    <div className="h-screen bg-slate-950 text-white flex overflow-hidden">
      <ProjectNav projectId={params.id} />
      {/* h-full so child pages can use min-h-full to fill the pane */}
      <div className="flex-1 h-full overflow-auto min-w-0">{children}</div>
    </div>
  );
}
