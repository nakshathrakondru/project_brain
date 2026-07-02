import Link from "next/link";
import { Brain, MessageSquare, Search, CheckSquare, Network, Clock, Users, BarChart3, Settings } from "lucide-react";

const navItems = [
  { href: "", label: "Overview", icon: Brain },
  { href: "/ask", label: "AI Tech Lead", icon: MessageSquare },
  { href: "/search", label: "Search", icon: Search },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/graph", label: "Graph", icon: Network },
  { href: "/timeline", label: "Timeline", icon: Clock },
  { href: "/onboarding", label: "Onboarding", icon: Users },
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const { id } = params;

  return (
    <div className="min-h-screen bg-slate-950 text-white flex">
      {/* Sidebar */}
      <aside className="w-56 border-r border-white/10 flex flex-col">
        <div className="px-4 py-5 border-b border-white/10">
          <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Brain className="h-5 w-5 text-blue-400" />
            <span className="font-semibold text-sm">Project Brain</span>
          </Link>
        </div>
        <nav className="flex-1 px-2 py-4 space-y-0.5">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={`/projects/${id}${href}`}
              className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors"
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
