import { SignIn } from "@clerk/nextjs";
import { Brain, Shield, User } from "lucide-react";

const DEMO_ACCOUNTS = [
  {
    role: "Manager",
    icon: Shield,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    userid: "manager",
    password: "manager@235",
    note: "Can create projects, assign employees, create tickets",
  },
  {
    role: "Employee 1",
    icon: User,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
    userid: "employee1",
    password: "employee@235",
    note: "Sees assigned projects only, uses code editor & agent",
  },
  {
    role: "Employee 2",
    icon: User,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    userid: "employee2",
    password: "employee@235",
    note: "Second employee for multi-developer demo",
  },
];

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6 gap-10 flex-wrap">

      {/* Demo credentials panel */}
      <div className="w-80 flex-shrink-0">
        <div className="flex items-center gap-2 mb-5">
          <Brain className="h-5 w-5 text-blue-400" />
          <span className="font-semibold text-lg">Mycelium</span>
        </div>
        <h2 className="text-sm font-medium text-white/60 uppercase tracking-wider mb-4">
          Demo accounts
        </h2>
        <div className="space-y-3">
          {DEMO_ACCOUNTS.map((a) => (
            <div key={a.role}
              className={`${a.bg} border ${a.border} rounded-xl p-4`}>
              <div className="flex items-center gap-2 mb-2">
                <a.icon className={`h-4 w-4 ${a.color}`} />
                <span className={`text-sm font-semibold ${a.color}`}>{a.role}</span>
              </div>
              <div className="space-y-1 text-xs font-mono text-white/60">
                <div className="flex justify-between">
                  <span className="text-white/35">User ID</span>
                  <span className="text-white/80 select-all">{a.userid}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/35">Password</span>
                  <span className="text-white/80 select-all">{a.password}</span>
                </div>
              </div>
              <p className="text-xs text-white/30 mt-2 leading-relaxed">{a.note}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-white/20 mt-4 leading-relaxed">
          Sign in with any account above using the Clerk form →
        </p>
      </div>

      {/* Clerk sign-in widget */}
      <div>
        <SignIn />
      </div>

    </div>
  );
}
