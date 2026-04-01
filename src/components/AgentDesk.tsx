import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface Agent {
  id: string;
  name: string;
  status: string;
  role: string;
  department: string;
  current_task: string | null;
  tokens_used: number;
}

const statusColors: Record<string, { dot: string; ring: string; bg: string }> = {
  working: { dot: "bg-green-500", ring: "ring-green-500/20", bg: "bg-green-500/5" },
  idle: { dot: "bg-muted-foreground/40", ring: "ring-border", bg: "bg-card" },
  paused: { dot: "bg-yellow-500", ring: "ring-yellow-500/20", bg: "bg-yellow-500/5" },
  offline: { dot: "bg-red-500", ring: "ring-red-500/20", bg: "bg-muted/30" },
};

const agentColors: Record<string, string> = {
  hivemind: "bg-blue-500",
  omega: "bg-purple-500",
  prism: "bg-emerald-500",
  oracle: "bg-amber-500",
  sentinel: "bg-rose-500",
  hawkeye: "bg-cyan-500",
  atlas: "bg-indigo-500",
};

export function AgentDesk({ agent }: { agent: Agent }) {
  const style = statusColors[agent.status] || statusColors.idle;
  const avatarBg = agentColors[agent.name.toLowerCase()] || "bg-muted-foreground";
  const isOffline = agent.status === "offline";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={`relative rounded-xl border ${style.bg} ring-1 ${style.ring} p-4 text-left transition-all hover:ring-primary/30 hover:border-primary/20 w-full ${isOffline ? "opacity-50" : ""}`}
        >
          {/* Status dot */}
          <span className={`absolute top-3 right-3 h-2 w-2 rounded-full ${style.dot} ${agent.status === "working" ? "animate-pulse" : ""}`} />

          {/* Avatar */}
          <div className={`h-10 w-10 rounded-full ${avatarBg} flex items-center justify-center text-sm font-bold text-white mb-3`}>
            {agent.name.charAt(0)}
          </div>

          {/* Name & task */}
          <p className="text-sm font-medium truncate">{agent.name}</p>
          <p className="text-[10px] text-muted-foreground capitalize mt-0.5">{agent.status}</p>
          {agent.current_task && (
            <p className="text-[10px] text-muted-foreground/70 truncate mt-1.5 border-t border-border/50 pt-1.5">
              {agent.current_task}
            </p>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3 space-y-2" side="top">
        <div className="flex items-center gap-2">
          <div className={`h-7 w-7 rounded-full ${avatarBg} flex items-center justify-center text-xs font-bold text-white`}>
            {agent.name.charAt(0)}
          </div>
          <div>
            <p className="text-sm font-medium">{agent.name}</p>
            <p className="text-[10px] text-muted-foreground">{agent.role}</p>
          </div>
        </div>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Department</span>
            <span>{agent.department}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Status</span>
            <span className="capitalize">{agent.status}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tokens</span>
            <span className="font-mono">{agent.tokens_used.toLocaleString()}</span>
          </div>
          {agent.current_task && (
            <div>
              <span className="text-muted-foreground block">Current Task</span>
              <p className="mt-0.5">{agent.current_task}</p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
