import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Activity, CheckCircle, Zap, Brain, FileText } from "lucide-react";
import { differenceInMinutes } from "date-fns";

export function OfficeOverview() {
  const { data: tasks } = useQuery({
    queryKey: ["overview-tasks"],
    queryFn: async () => {
      const { data } = await supabase.from("tasks").select("*").order("created_at", { ascending: false }).limit(100);
      return data || [];
    },
    refetchInterval: 15000,
  });

  const { data: agents } = useQuery({
    queryKey: ["overview-agents"],
    queryFn: async () => {
      const { data } = await supabase.from("agents").select("*");
      return data || [];
    },
    refetchInterval: 15000,
  });

  const { data: outputs } = useQuery({
    queryKey: ["overview-outputs"],
    queryFn: async () => {
      const { data } = await supabase.from("task_outputs").select("id, task_id, output_type, title, created_at").order("created_at", { ascending: false }).limit(5);
      return data || [];
    },
    refetchInterval: 15000,
  });

  const { data: memories } = useQuery({
    queryKey: ["overview-memories"],
    queryFn: async () => {
      const { data } = await supabase.from("agent_memory").select("id, agent_id, content, created_at").order("created_at", { ascending: false }).limit(3);
      return data || [];
    },
    refetchInterval: 15000,
  });

  const allTasks = tasks || [];
  const done = allTasks.filter(t => t.status === "done").length;
  const inProgress = allTasks.filter(t => t.status === "in_progress").length;
  const queued = allTasks.filter(t => t.status === "queued").length;
  const working = (agents || []).filter(a => a.status === "working").length;
  const idle = (agents || []).filter(a => a.status === "idle").length;
  const totalAgents = agents?.length || 0;
  const agentMap = Object.fromEntries((agents || []).map(a => [a.id, a.name]));

  // Recent activity: tasks modified in last 30min
  const recentActive = allTasks.filter(t => {
    const diff = differenceInMinutes(new Date(), new Date(t.created_at));
    return diff < 30;
  }).length;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      {/* System Activity */}
      <div className="surface-2 rounded-lg p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <Activity className="h-3 w-3 text-primary" />
          <span className="text-[9.5px] uppercase tracking-[0.18em] font-medium text-muted-foreground">System Activity</span>
        </div>
        <p className="stat-display text-2xl font-semibold leading-none text-foreground">{recentActive}</p>
        <p className="text-[9.5px] text-muted-foreground mt-1.5">tasks · last 30m</p>
      </div>

      {/* Agent Status */}
      <div className="surface-2 rounded-lg p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <Zap className="h-3 w-3" style={{ color: "oklch(74% 0.18 65)" }} />
          <span className="text-[9.5px] uppercase tracking-[0.18em] font-medium text-muted-foreground">Agent Status</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="stat-display text-2xl font-semibold leading-none" style={{ color: "oklch(72% 0.18 155)" }}>{working}</span>
          <span className="text-[10px] text-muted-foreground">working</span>
          <span className="stat-display text-2xl font-semibold leading-none text-muted-foreground/70">{idle}</span>
          <span className="text-[10px] text-muted-foreground">idle</span>
        </div>
        <p className="text-[9.5px] text-muted-foreground mt-1.5">{totalAgents} total agents</p>
      </div>

      {/* Task Pipeline */}
      <div className="surface-2 rounded-lg p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <CheckCircle className="h-3 w-3" style={{ color: "oklch(72% 0.18 155)" }} />
          <span className="text-[9.5px] uppercase tracking-[0.18em] font-medium text-muted-foreground">Task Pipeline</span>
        </div>
        <div className="flex items-end gap-3">
          <div>
            <p className="stat-display text-xl font-semibold leading-none">{queued}</p>
            <p className="text-[9px] text-muted-foreground mt-1 uppercase tracking-wider">queued</p>
          </div>
          <div>
            <p className="stat-display text-xl font-semibold leading-none" style={{ color: "oklch(74% 0.18 65)" }}>{inProgress}</p>
            <p className="text-[9px] text-muted-foreground mt-1 uppercase tracking-wider">active</p>
          </div>
          <div>
            <p className="stat-display text-xl font-semibold leading-none" style={{ color: "oklch(72% 0.18 155)" }}>{done}</p>
            <p className="text-[9px] text-muted-foreground mt-1 uppercase tracking-wider">done</p>
          </div>
        </div>
      </div>

      {/* Recent Outputs */}
      <div className="surface-2 rounded-lg p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <FileText className="h-3 w-3 text-primary" />
          <span className="text-[9.5px] uppercase tracking-[0.18em] font-medium text-muted-foreground">Recent Outputs</span>
        </div>
        <div className="space-y-1">
          {(outputs || []).slice(0, 3).map(o => (
            <p key={o.id} className="text-[10px] text-muted-foreground truncate leading-snug">
              <span className="text-primary/90 capitalize font-medium">{o.output_type}</span>
              <span className="text-muted-foreground/40 mx-1">·</span>
              {o.title}
            </p>
          ))}
          {(!outputs || outputs.length === 0) && (
            <p className="text-[10px] text-muted-foreground/60 italic">No outputs yet</p>
          )}
        </div>
      </div>

      {/* Latest Learnings — full width */}
      {memories && memories.length > 0 && (
        <div className="col-span-2 md:col-span-4 surface-1 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Brain className="h-3 w-3 text-primary" />
            <span className="text-[9.5px] uppercase tracking-[0.18em] font-medium text-muted-foreground">Latest Learnings</span>
          </div>
          <div className="flex gap-4 overflow-x-auto">
            {memories.map(m => (
              <div key={m.id} className="shrink-0 max-w-[220px] text-[10px] border-l-2 border-primary/30 pl-2.5">
                <span className="text-primary/90 font-medium uppercase tracking-wider text-[9px]">
                  {agentMap[m.agent_id] || m.agent_id}
                </span>
                <p className="text-muted-foreground line-clamp-2 mt-0.5 leading-snug">{m.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
