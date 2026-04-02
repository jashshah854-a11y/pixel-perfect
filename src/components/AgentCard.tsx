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
  working: "bg-green-400",
  idle: "bg-zinc-500",
  paused: "bg-yellow-400",
  offline: "bg-red-400",
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
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${statusDot[agent.status] || "bg-zinc-500"}`} />
          <span className="font-medium">{agent.name}</span>
        </div>
        <StatusBadge value={agent.department} />
      </div>

      {!compact && <p className="text-sm text-muted-foreground">{agent.role}</p>}

      {agent.current_task && (
        <p className="text-sm truncate text-muted-foreground">
          📌 {agent.current_task}
        </p>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-mono">{agent.tokens_used.toLocaleString()} tokens</span>
        {!compact && onStatusChange && (
          <select
            value={agent.status}
            onChange={(e) => onStatusChange(agent.id, e.target.value)}
            className="bg-secondary rounded px-2 py-1 text-xs text-foreground border-none outline-none"
          >
            <option value="idle">Idle</option>
            <option value="working">Working</option>
            <option value="paused">Paused</option>
            <option value="offline">Offline</option>
          </select>
        )}
      </div>

      {!compact && onAssignTask && (
        <div className="flex gap-2">
          <button
            onClick={() => onAssignTask(agent.id)}
            className="flex-1 text-xs rounded bg-primary/10 text-primary py-1.5 hover:bg-primary/20"
          >
            Assign Task
          </button>
          <button
            onClick={() => setShowMemory(!showMemory)}
            className="text-xs rounded bg-muted px-2.5 py-1.5 hover:bg-muted/80 flex items-center gap-1"
          >
            <Brain className="h-3 w-3" />
            Memory
          </button>
        </div>
      )}

      {showMemory && (
        <div className="pt-2 border-t border-border/50">
          <AgentMemoryView agentId={agent.id} agentName={agent.name} />
        </div>
      )}
    </div>
  );
}
