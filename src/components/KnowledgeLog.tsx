import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { ChevronDown, ChevronUp, Brain, BookOpen } from "lucide-react";
import { format } from "date-fns";
import { StatusBadge } from "@/components/StatusBadge";

interface KnowledgeLogProps {
  agents: Array<{ id: string; name: string }>;
}

export function KnowledgeLog({ agents }: KnowledgeLogProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterAgent, setFilterAgent] = useState("");
  const agentMap = Object.fromEntries(agents.map((a) => [a.id, a.name]));

  const { data: completedTasks } = useQuery({
    queryKey: ["completed-tasks"],
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select("*")
        .eq("status", "done")
        .order("completed_at", { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  const { data: assignments } = useQuery({
    queryKey: ["all-assignments"],
    queryFn: async () => {
      const { data } = await supabase.from("task_assignments").select("*");
      return data || [];
    },
  });

  const { data: memories } = useQuery({
    queryKey: ["all-memories"],
    queryFn: async () => {
      const { data } = await supabase.from("agent_memory").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const tasks = (completedTasks || []).filter((t) => {
    if (!filterAgent) return true;
    return t.assigned_to === filterAgent;
  });

  const totalMemories = memories?.length || 0;
  const avgConfidence = memories?.length
    ? (memories.reduce((s, m) => s + m.confidence, 0) / memories.length).toFixed(2)
    : "0";

  // Learning trajectory: per-agent memory count and avg confidence
  const agentTrajectory: Record<string, { count: number; avgConf: number }> = {};
  for (const m of memories || []) {
    if (!agentTrajectory[m.agent_id]) agentTrajectory[m.agent_id] = { count: 0, avgConf: 0 };
    agentTrajectory[m.agent_id].count += 1;
    agentTrajectory[m.agent_id].avgConf += m.confidence;
  }
  for (const id of Object.keys(agentTrajectory)) {
    agentTrajectory[id].avgConf = agentTrajectory[id].avgConf / agentTrajectory[id].count;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Knowledge Log</h3>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{tasks.length} completed</span>
          <span>{totalMemories} memories</span>
          <span>avg conf: {avgConfidence}</span>
        </div>
      </div>

      <select
        value={filterAgent}
        onChange={(e) => setFilterAgent(e.target.value)}
        className="rounded-md border bg-background px-2 py-1 text-sm"
      >
        <option value="">All Agents</option>
        {agents.map((a) => (
          <option key={a.id} value={a.id}>{a.name}</option>
        ))}
      </select>

      {/* Learning Trajectory */}
      {Object.keys(agentTrajectory).length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-muted-foreground">Learning Trajectory</p>
          <div className="flex gap-2 flex-wrap">
            {agents.filter(a => agentTrajectory[a.id]).map(a => {
              const t = agentTrajectory[a.id];
              const barWidth = Math.min((t.count / Math.max(...Object.values(agentTrajectory).map(v => v.count), 1)) * 100, 100);
              return (
                <div key={a.id} className="flex items-center gap-1.5 text-[10px]">
                  <span className="w-14 truncate text-muted-foreground">{a.name}</span>
                  <div className="w-16 h-1.5 bg-muted/30 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${barWidth}%` }} />
                  </div>
                  <span className="font-mono text-muted-foreground">{t.count}</span>
                  <span className={`font-mono ${t.avgConf >= 0.7 ? "text-emerald-400" : "text-amber-400"}`}>
                    {(t.avgConf * 100).toFixed(0)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
        {tasks.map((task) => {
          const taskAssigns = (assignments || []).filter((a) => a.task_id === task.id);
          const taskMemories = (memories || []).filter((m) => m.source_task_id === task.id);
          const isExpanded = expandedId === task.id;

          return (
            <div key={task.id} className="rounded-md border border-border/40 bg-card/60">
              <button
                onClick={() => setExpandedId(isExpanded ? null : task.id)}
                className="w-full flex items-center justify-between p-2.5 text-left"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <BookOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-sm truncate">{task.title}</span>
                  <StatusBadge value={task.priority} />
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-muted-foreground">
                    {task.completed_at ? format(new Date(task.completed_at), "MMM d") : "—"}
                  </span>
                  {agentMap[task.assigned_to || ""] && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                      {agentMap[task.assigned_to || ""]}
                    </span>
                  )}
                  {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-border/30 p-3 space-y-3 text-xs">
                  {task.description && (
                    <p className="text-muted-foreground">{task.description}</p>
                  )}

                  {taskAssigns.length > 0 && (
                    <div>
                      <p className="font-medium mb-1">Assignments</p>
                      {taskAssigns.map((a) => (
                        <div key={a.id} className="flex items-center gap-2 py-0.5">
                          <span className="text-primary">{agentMap[a.agent_id] || a.agent_id}</span>
                          <span className="text-muted-foreground capitalize">({a.role})</span>
                          <span className="text-muted-foreground">score: {a.fit_score}</span>
                          {a.reasoning && (
                            <span className="text-muted-foreground/70 truncate max-w-[200px]">{a.reasoning}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {taskMemories.length > 0 && (
                    <div>
                      <p className="font-medium mb-1 flex items-center gap-1">
                        <Brain className="h-3 w-3" /> Learnings
                      </p>
                      {taskMemories.map((m) => (
                        <div key={m.id} className="py-1 border-l-2 border-primary/30 pl-2 mb-1">
                          <p>{m.content}</p>
                          <p className="text-muted-foreground/60 mt-0.5">
                            {m.memory_type} • confidence: {m.confidence}
                            {m.tags && m.tags.length > 0 && ` • ${m.tags.join(", ")}`}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {taskAssigns.length === 0 && taskMemories.length === 0 && (
                    <p className="text-muted-foreground">No detailed records for this task.</p>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {tasks.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">No completed tasks yet.</p>
        )}
      </div>
    </div>
  );
}
