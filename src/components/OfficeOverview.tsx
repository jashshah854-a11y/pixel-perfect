import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Activity, CheckCircle, Clock, Zap, Brain, FileText } from "lucide-react";
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
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-2">
      {/* KPIs */}
      <div className="rounded-lg border border-border/20 bg-card/40 p-2.5 space-y-1">
        <div className="flex items-center gap-1.5">
          <Activity className="h-3 w-3 text-primary" />
          <span className="text-[10px] text-muted-foreground font-medium">System Activity</span>
        </div>
        <p className="text-lg font-semibold font-mono tabular-nums">{recentActive}</p>
        <p className="text-[9px] text-muted-foreground">tasks in last 30m</p>
      </div>

      <div className="rounded-lg border border-border/20 bg-card/40 p-2.5 space-y-1">
        <div className="flex items-center gap-1.5">
          <Zap className="h-3 w-3 text-amber-400" />
          <span className="text-[10px] text-muted-foreground font-medium">Agent Status</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-semibold font-mono text-emerald-400">{working}</span>
          <span className="text-[9px] text-muted-foreground">working</span>
          <span className="text-lg font-semibold font-mono text-muted-foreground">{idle}</span>
          <span className="text-[9px] text-muted-foreground">idle</span>
        </div>
        <p className="text-[9px] text-muted-foreground">{totalAgents} total agents</p>
      </div>

      <div className="rounded-lg border border-border/20 bg-card/40 p-2.5 space-y-1">
        <div className="flex items-center gap-1.5">
          <CheckCircle className="h-3 w-3 text-emerald-400" />
          <span className="text-[10px] text-muted-foreground font-medium">Task Pipeline</span>
        </div>
        <div className="flex gap-3 text-xs font-mono tabular-nums">
          <div className="text-center">
            <p className="text-base font-semibold">{queued}</p>
            <p className="text-[8px] text-muted-foreground">queued</p>
          </div>
          <div className="text-center">
            <p className="text-base font-semibold text-amber-400">{inProgress}</p>
            <p className="text-[8px] text-muted-foreground">active</p>
          </div>
          <div className="text-center">
            <p className="text-base font-semibold text-emerald-400">{done}</p>
            <p className="text-[8px] text-muted-foreground">done</p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border/20 bg-card/40 p-2.5 space-y-1">
        <div className="flex items-center gap-1.5">
          <FileText className="h-3 w-3 text-primary" />
          <span className="text-[10px] text-muted-foreground font-medium">Recent Outputs</span>
        </div>
        <div className="space-y-0.5 max-h-14 overflow-hidden">
          {(outputs || []).slice(0, 3).map(o => (
            <p key={o.id} className="text-[9px] text-muted-foreground truncate">
              <span className="text-primary/70 capitalize">{o.output_type}</span> · {o.title}
            </p>
          ))}
          {(!outputs || outputs.length === 0) && (
            <p className="text-[9px] text-muted-foreground">No outputs yet</p>
          )}
        </div>
      </div>

      {/* Recent learnings - spans full width */}
      {memories && memories.length > 0 && (
        <div className="col-span-2 md:col-span-4 rounded-lg border border-border/20 bg-card/40 p-2.5">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Brain className="h-3 w-3 text-primary" />
            <span className="text-[10px] text-muted-foreground font-medium">Latest Learnings</span>
          </div>
          <div className="flex gap-3 overflow-x-auto">
            {memories.map(m => (
              <div key={m.id} className="shrink-0 max-w-[200px] text-[9px] text-muted-foreground border-l border-primary/20 pl-2">
                <span className="text-primary/70">{agentMap[m.agent_id] || m.agent_id}</span>
                <p className="truncate mt-0.5">{m.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
