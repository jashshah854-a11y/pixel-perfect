import { useState, useEffect, useMemo } from "react";
import {
  GitBranch,
  Bot,
  Zap,
  AlertTriangle,
  Search,
  CheckCircle,
  Clock,
  ArrowDown,
  Users,
  Activity,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface OrchestrationResult {
  subtasks: Array<{
    task_id: string;
    title: string;
    owner: string | null;
    owner_name: string | null;
    type: string;
    priority?: string;
    delegatedTo?: string | null;
    assignments: Array<{ agent_id: string; role: string; fit_score?: number }>;
  }>;
  orchestration: {
    primaryAgents: string[];
    subAgentSpawns: Array<{
      parentName: string;
      subAgentName: string;
      reason: string;
      delegatedTasks: string[];
    }>;
    escalations: Array<{
      agentName: string;
      reason: string;
      action: string;
    }>;
    researchTriggers: Array<{
      agentName: string;
      topic: string;
    }>;
    totalTasks: number;
    delegationChains: Array<{
      task: string;
      from: string;
      to: string;
    }>;
  };
}

const AGENT_COLORS: Record<string, string> = {
  hivemind: "from-violet-500 to-violet-600",
  omega: "from-cyan-500 to-cyan-600",
  prism: "from-pink-500 to-pink-600",
  oracle: "from-amber-500 to-amber-600",
  sentinel: "from-red-500 to-red-600",
  hawkeye: "from-emerald-500 to-emerald-600",
  atlas: "from-sky-500 to-sky-600",
};

const AGENT_BADGE_COLORS: Record<string, string> = {
  hivemind: "bg-violet-500/20 text-violet-400 border-violet-500/30",
  omega: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  prism: "bg-pink-500/20 text-pink-400 border-pink-500/30",
  oracle: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  sentinel: "bg-red-500/20 text-red-400 border-red-500/30",
  hawkeye: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  atlas: "bg-sky-500/20 text-sky-400 border-sky-500/30",
};

function getAgentColor(name: string): string {
  return AGENT_COLORS[name.toLowerCase()] || "from-primary to-primary";
}

function getAgentBadge(name: string): string {
  return AGENT_BADGE_COLORS[name.toLowerCase()] || "";
}

interface OrchestrationFlowViewProps {
  planTitle: string;
  result: OrchestrationResult;
  isAnimating?: boolean;
}

export function OrchestrationFlowView({ planTitle, result, isAnimating = true }: OrchestrationFlowViewProps) {
  const [visibleNodes, setVisibleNodes] = useState(0);
  const [phase, setPhase] = useState<"intake" | "routing" | "delegation" | "research" | "active">("intake");

  const { subtasks, orchestration } = result;

  // Group tasks by owner
  const tasksByAgent = useMemo(() => {
    const map: Record<string, typeof subtasks> = {};
    for (const t of subtasks) {
      const key = t.owner_name || "Unassigned";
      if (!map[key]) map[key] = [];
      map[key].push(t);
    }
    return map;
  }, [subtasks]);

  // Animation sequence
  useEffect(() => {
    if (!isAnimating) {
      setVisibleNodes(subtasks.length + 10);
      setPhase("active");
      return;
    }

    const timers: ReturnType<typeof setTimeout>[] = [];

    timers.push(setTimeout(() => setPhase("routing"), 800));
    timers.push(setTimeout(() => setPhase("delegation"), 1600));
    timers.push(setTimeout(() => {
      setPhase(orchestration.researchTriggers.length > 0 ? "research" : "active");
    }, 2400));
    if (orchestration.researchTriggers.length > 0) {
      timers.push(setTimeout(() => setPhase("active"), 3200));
    }

    // Stagger node reveals
    for (let i = 0; i <= subtasks.length; i++) {
      timers.push(setTimeout(() => setVisibleNodes(i + 1), 600 + i * 200));
    }

    return () => timers.forEach(clearTimeout);
  }, [isAnimating, subtasks.length, orchestration.researchTriggers.length]);

  const phaseIndex = ["intake", "routing", "delegation", "research", "active"].indexOf(phase);

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Phase Indicator */}
      <div className="flex items-center gap-1">
        {["Intake", "Routing", "Delegation", "Research", "Active"].map((label, i) => (
          <div key={label} className="flex items-center gap-1">
            <div className={`h-1.5 flex-1 rounded-full min-w-[40px] transition-all duration-500 ${
              i <= phaseIndex ? "bg-primary" : "bg-muted/30"
            }`} />
            <span className={`text-[9px] transition-colors duration-300 ${
              i <= phaseIndex ? "text-primary" : "text-muted-foreground/30"
            }`}>{label}</span>
          </div>
        ))}
      </div>

      {/* Plan Entry Node */}
      <div className="flex flex-col items-center">
        <div className={`rounded-lg border-2 border-primary/50 bg-primary/10 px-4 py-2.5 flex items-center gap-2 transition-all duration-500 ${
          phase !== "intake" ? "opacity-100 scale-100" : "opacity-80 scale-95"
        }`}>
          <GitBranch className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">{planTitle}</span>
          <Badge variant="outline" className="text-[9px] bg-primary/20 text-primary border-primary/30">
            {subtasks.length} tasks
          </Badge>
        </div>

        {/* Connector */}
        <div className={`w-px h-6 transition-all duration-500 ${
          phaseIndex >= 1 ? "bg-primary/50" : "bg-muted/20"
        }`} />
        <ArrowDown className={`h-3 w-3 transition-colors duration-500 ${
          phaseIndex >= 1 ? "text-primary/50" : "text-muted/20"
        }`} />
      </div>

      {/* Primary Agent Routing */}
      <div className={`transition-all duration-500 ${phaseIndex >= 1 ? "opacity-100" : "opacity-20"}`}>
        <div className="flex items-center gap-2 mb-2">
          <Bot className="h-3.5 w-3.5 text-primary" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
            Primary Routing
          </span>
          <span className="text-[10px] text-muted-foreground">
            {orchestration.primaryAgents.length} agents
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
          {Object.entries(tasksByAgent).map(([agentName, tasks], idx) => (
            <div
              key={agentName}
              className={`rounded-lg border border-border/30 bg-card/60 p-3 transition-all duration-300 ${
                idx < visibleNodes ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
              }`}
              style={{ transitionDelay: `${idx * 100}ms` }}
            >
              {/* Agent header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`h-2.5 w-2.5 rounded-full bg-gradient-to-br ${getAgentColor(agentName)}`} />
                  <span className="text-xs font-medium">{agentName}</span>
                </div>
                <Badge variant="outline" className={`text-[9px] px-1 py-0 ${getAgentBadge(agentName)}`}>
                  {tasks.length}
                </Badge>
              </div>

              {/* Tasks */}
              <div className="space-y-1">
                {tasks.map((task, ti) => (
                  <div
                    key={task.task_id}
                    className={`flex items-center gap-1.5 text-[10px] rounded px-1.5 py-1 transition-all duration-200 ${
                      task.type === "coordination"
                        ? "bg-primary/10 text-primary"
                        : "bg-muted/20 text-muted-foreground"
                    } ${visibleNodes > idx ? "opacity-100" : "opacity-0"}`}
                    style={{ transitionDelay: `${(idx * tasks.length + ti) * 50}ms` }}
                  >
                    {task.type === "coordination" ? (
                      <Zap className="h-2.5 w-2.5 flex-shrink-0" />
                    ) : (
                      <Activity className="h-2.5 w-2.5 flex-shrink-0" />
                    )}
                    <span className="truncate flex-1">{task.title}</span>
                    {task.priority === "high" && (
                      <span className="text-[8px] text-amber-400">●</span>
                    )}
                  </div>
                ))}
              </div>

              {/* Delegation indicator */}
              {tasks.some(t => t.delegatedTo) && (
                <div className="mt-2 pt-1.5 border-t border-border/20">
                  <div className="flex items-center gap-1 text-[9px] text-violet-400">
                    <Users className="h-2.5 w-2.5" />
                    <span>Delegated to sub-agents</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Sub-Agent Spawns */}
      {orchestration.subAgentSpawns.length > 0 && (
        <div className={`transition-all duration-500 ${phaseIndex >= 2 ? "opacity-100" : "opacity-20"}`}>
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-3.5 w-3.5 text-violet-400" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              Sub-Agent Spawns
            </span>
          </div>
          <div className="space-y-2">
            {orchestration.subAgentSpawns.map((spawn, i) => (
              <div
                key={i}
                className={`rounded-md border border-violet-500/20 bg-violet-500/5 p-2.5 transition-all duration-300 ${
                  phaseIndex >= 2 ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"
                }`}
                style={{ transitionDelay: `${i * 150}ms` }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-2 w-2 rounded-full bg-violet-400 animate-pulse" />
                  <span className="text-xs font-medium text-violet-400">{spawn.subAgentName}</span>
                  <span className="text-[9px] text-muted-foreground">spawned by {spawn.parentName}</span>
                </div>
                <p className="text-[10px] text-muted-foreground">{spawn.reason}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {spawn.delegatedTasks.map((task, ti) => (
                    <span key={ti} className="text-[9px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-300">
                      {task.slice(0, 40)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Escalations */}
      {orchestration.escalations.length > 0 && (
        <div className={`transition-all duration-500 ${phaseIndex >= 2 ? "opacity-100" : "opacity-20"}`}>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              Escalations
            </span>
          </div>
          {orchestration.escalations.map((esc, i) => (
            <div key={i} className="rounded-md border border-amber-500/20 bg-amber-500/5 p-2.5 text-xs">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-amber-400">{esc.agentName}</span>
              </div>
              <p className="text-[10px] text-muted-foreground">{esc.reason}</p>
              <p className="text-[10px] text-amber-400/80 mt-1">{esc.action}</p>
            </div>
          ))}
        </div>
      )}

      {/* Research Triggers */}
      {orchestration.researchTriggers.length > 0 && (
        <div className={`transition-all duration-500 ${phaseIndex >= 3 ? "opacity-100" : "opacity-20"}`}>
          <div className="flex items-center gap-2 mb-2">
            <Search className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              Research Initiated
            </span>
          </div>
          {orchestration.researchTriggers.map((rt, i) => (
            <div key={i} className="rounded-md border border-amber-500/20 bg-amber-500/5 p-2.5 flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-xs text-amber-400">{rt.agentName}</span>
              <span className="text-[10px] text-muted-foreground">→ {rt.topic}</span>
            </div>
          ))}
        </div>
      )}

      {/* Summary Bar */}
      <div className={`rounded-lg border border-border/30 bg-muted/20 p-3 flex items-center justify-between transition-all duration-500 ${
        phaseIndex >= 4 ? "opacity-100" : "opacity-40"
      }`}>
        <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <CheckCircle className="h-3 w-3 text-emerald-400" />
            {orchestration.totalTasks} tasks
          </span>
          <span className="flex items-center gap-1">
            <Bot className="h-3 w-3 text-primary" />
            {orchestration.primaryAgents.length} agents
          </span>
          {orchestration.subAgentSpawns.length > 0 && (
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3 text-violet-400" />
              {orchestration.subAgentSpawns.length} sub-agents
            </span>
          )}
          {orchestration.escalations.length > 0 && (
            <span className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-amber-400" />
              {orchestration.escalations.length} escalations
            </span>
          )}
          {orchestration.researchTriggers.length > 0 && (
            <span className="flex items-center gap-1">
              <Search className="h-3 w-3 text-amber-400" />
              {orchestration.researchTriggers.length} research
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3 text-muted-foreground/40" />
          <span className="text-[10px] text-muted-foreground/40">
            {phase === "active" ? "Orchestration complete" : `Phase: ${phase}`}
          </span>
        </div>
      </div>
    </div>
  );
}
