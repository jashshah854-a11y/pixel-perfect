import { StatusBadge } from "./StatusBadge";
import { AgentMemoryView } from "./AgentMemoryView";
import { useState } from "react";
import { Brain, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Agent {
  id: string;
  name: string;
  department: string;
  role: string;
  status: string;
  current_task: string | null;
  tokens_used: number;
}

interface AgentCardProps {
  agent: Agent;
  compact?: boolean;
  onStatusChange?: (id: string, status: string) => void;
  onAssignTask?: (id: string) => void;
}

const statusDot: Record<string, string> = {
  working: "bg-status-working status-dot--active",
  idle: "bg-status-idle",
  paused: "bg-yellow-400",
  offline: "bg-status-blocked",
};

export function AgentCard({ agent, compact, onStatusChange, onAssignTask }: AgentCardProps) {
  const [showMemory, setShowMemory] = useState(false);
  const [researching, setResearching] = useState(false);

  const triggerResearch = async () => {
    setResearching(true);
    try {
      await supabase.functions.invoke("agent-research", { body: { agent_id: agent.id } });
      toast.success(`${agent.name} completed a research session`);
    } catch {
      toast.error("Research failed");
    }
    setResearching(false);
  };

  return (
    <div className="interactive-card p-4 space-y-3 group">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className={`status-dot ${statusDot[agent.status] || "bg-status-idle"}`} />
          <span className="font-medium text-sm group-hover:text-foreground transition-colors duration-fast">
            {agent.name}
          </span>
        </div>
        <StatusBadge value={agent.department} />
      </div>

      {!compact && (
        <p className="text-sm text-muted-foreground leading-relaxed">{agent.role}</p>
      )}

      {agent.current_task && (
        <p className="text-sm truncate text-muted-foreground flex items-center gap-1.5">
          <span className="h-1 w-1 rounded-full bg-primary/60 shrink-0" />
          {agent.current_task}
        </p>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-mono tabular-nums">{agent.tokens_used.toLocaleString()} tokens</span>
        {!compact && onStatusChange && (
          <select
            value={agent.status}
            onChange={(e) => onStatusChange(agent.id, e.target.value)}
            className="bg-secondary rounded-md px-2 py-1 text-xs text-foreground border-none outline-none cursor-pointer hover:bg-secondary/80 transition-colors duration-fast"
          >
            <option value="idle">Idle</option>
            <option value="working">Working</option>
            <option value="paused">Paused</option>
            <option value="offline">Offline</option>
          </select>
        )}
      </div>

      {!compact && onAssignTask && (
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => onAssignTask(agent.id)}
            className="flex-1 text-xs font-medium rounded-md bg-primary/10 text-primary py-2 hover:bg-primary/20 press-effect transition-colors duration-fast"
          >
            Assign Task
          </button>
          <button
            onClick={() => setShowMemory(!showMemory)}
            className="text-xs rounded-md bg-muted px-3 py-2 hover:bg-muted/80 flex items-center gap-1.5 press-effect transition-colors duration-fast"
          >
            <Brain className="h-3.5 w-3.5" />
            Memory
          </button>
          {agent.status === "idle" && (
            <button
              onClick={triggerResearch}
              disabled={researching}
              className="text-xs rounded-md bg-muted px-3 py-2 hover:bg-muted/80 flex items-center gap-1.5 press-effect transition-colors duration-fast disabled:opacity-50"
            >
              <BookOpen className="h-3.5 w-3.5" />
              {researching ? "..." : "Research"}
            </button>
          )}
        </div>
      )}

      {showMemory && (
        <div className="pt-3 border-t border-border/30 enter-fade">
          <AgentMemoryView agentId={agent.id} agentName={agent.name} />
        </div>
      )}
    </div>
  );
}
