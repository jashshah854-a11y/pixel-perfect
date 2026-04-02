import { StatusBadge } from "./StatusBadge";
import { AgentMemoryView } from "./AgentMemoryView";
import { useState } from "react";
import { Brain } from "lucide-react";

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
        <button
          onClick={() => onAssignTask(agent.id)}
          className="w-full mt-1 text-xs rounded bg-primary/10 text-primary py-1.5 hover:bg-primary/20"
        >
          Assign Task
        </button>
      )}
    </div>
  );
}
