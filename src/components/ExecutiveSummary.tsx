import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, AlertTriangle, Target, Flame, Clock, TrendingUp, Star, Shield, Lightbulb, Bot, Brain } from "lucide-react";
import { format } from "date-fns";

export function ExecutiveSummary() {
  const { data: tasks } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data } = await supabase.from("tasks").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: agents } = useQuery({
    queryKey: ["agents"],
    queryFn: async () => {
      const { data } = await supabase.from("agents").select("*");
      return data || [];
    },
  });

  const { data: memories } = useQuery({
    queryKey: ["all-memories"],
    queryFn: async () => {
      const { data } = await supabase.from("agent_memory").select("*").order("created_at", { ascending: false }).limit(50);
      return data || [];
    },
  });

  const { data: assignments } = useQuery({
    queryKey: ["task-assignments"],
    queryFn: async () => {
      const { data } = await supabase.from("task_assignments").select("*").order("claimed_at", { ascending: false }).limit(100);
      return data || [];
    },
  });

  const { data: suggestions } = useQuery({
    queryKey: ["system-suggestions"],
    queryFn: async () => {
      const { data } = await supabase.from("system_suggestions").select("*").eq("status", "pending").order("created_at", { ascending: false }).limit(3);
      return data || [];
    },
  });

  const { data: autonomousActions } = useQuery({
    queryKey: ["autonomous-actions-exec"],
    queryFn: async () => {
      const { data } = await supabase.from("autonomous_actions").select("*").order("created_at", { ascending: false }).limit(5);
      return data || [];
    },
  });

  const active = tasks?.filter(t => t.status === "in_progress") || [];
  const blocked = tasks?.filter(t => t.status === "blocked") || [];
  const queued = tasks?.filter(t => t.status === "queued") || [];
  const recentDone = tasks?.filter(t => t.status === "done").slice(0, 5) || [];
  const urgent = tasks?.filter(t => t.priority === "urgent" || t.priority === "high") || [];

  const agentMap = Object.fromEntries((agents || []).map(a => [a.id, a.name]));

  const completionCounts: Record<string, number> = {};
  for (const t of tasks?.filter(t => t.status === "done") || []) {
    if (t.assigned_to) completionCounts[t.assigned_to] = (completionCounts[t.assigned_to] || 0) + 1;
  }
  const topPerformers = Object.entries(completionCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);

  const decisions: Array<{ text: string; type: "risk" | "action" | "info" }> = [];
  if (blocked.length > 0) decisions.push({ text: `${blocked.length} blocked task${blocked.length > 1 ? "s" : ""} need attention`, type: "risk" });
  if (queued.length > 3) decisions.push({ text: `${queued.length} tasks queued — consider prioritization`, type: "action" });
  const offlineAgents = agents?.filter(a => a.status === "offline") || [];
  if (offlineAgents.length > 0) decisions.push({ text: `${offlineAgents.length} agent${offlineAgents.length > 1 ? "s" : ""} offline`, type: "info" });

  // Memory growth: count memories per agent
  const memPerAgent: Record<string, number> = {};
  for (const m of memories || []) {
    memPerAgent[m.agent_id] = (memPerAgent[m.agent_id] || 0) + 1;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Executive Summary</h3>
      </div>

      {/* Key Stats Row */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "Active", value: active.length, icon: Flame, color: "text-emerald-400" },
          { label: "Queued", value: queued.length, icon: Clock, color: "text-blue-400" },
          { label: "Blocked", value: blocked.length, icon: AlertTriangle, color: blocked.length > 0 ? "text-red-400" : "text-muted-foreground" },
          { label: "Completed", value: recentDone.length, icon: Trophy, color: "text-amber-400" },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded-md bg-muted/30 border border-border/20 p-2 text-center">
              <Icon className={`h-3.5 w-3.5 mx-auto mb-1 ${s.color}`} />
              <p className="text-lg font-bold font-mono">{s.value}</p>
              <p className="text-[9px] text-muted-foreground">{s.label}</p>
            </div>
          );
        })}
      </div>

      {/* Predicted Next Steps */}
      {suggestions && suggestions.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
            <Lightbulb className="h-3 w-3 text-amber-400" /> Predicted Next Steps
          </p>
          {suggestions.map(s => (
            <div key={s.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-amber-500/5 border border-amber-500/15 text-[11px]">
              <Lightbulb className="h-2.5 w-2.5 text-amber-400 shrink-0" />
              <span className="truncate flex-1">{s.title}</span>
              <span className="text-[9px] text-muted-foreground shrink-0">{Math.round(s.confidence * 100)}%</span>
            </div>
          ))}
        </div>
      )}

      {/* Autonomous Actions */}
      {autonomousActions && autonomousActions.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
            <Bot className="h-3 w-3 text-emerald-400" /> Recent Autonomous Actions
          </p>
          {autonomousActions.slice(0, 3).map(a => (
            <div key={a.id} className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-emerald-500/5 text-[11px]">
              <Bot className="h-2.5 w-2.5 text-emerald-400 shrink-0" />
              <span className="truncate flex-1">{a.description}</span>
              <span className="text-muted-foreground/60 text-[9px] shrink-0">
                {format(new Date(a.created_at), "HH:mm")}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Top Active Priorities */}
      {(urgent.length > 0 || active.length > 0) && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
            <Target className="h-3 w-3" /> Top Priorities
          </p>
          {[...urgent.filter(t => t.status !== "done"), ...active]
            .filter((t, i, arr) => arr.findIndex(a => a.id === t.id) === i)
            .slice(0, 4)
            .map(t => (
              <div key={t.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-muted/20 text-xs">
                <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                  t.priority === "urgent" ? "bg-red-400" : t.priority === "high" ? "bg-amber-400" : "bg-blue-400"
                }`} />
                <span className="truncate flex-1">{t.title}</span>
                {t.assigned_to && (
                  <span className="text-[10px] text-muted-foreground shrink-0">{agentMap[t.assigned_to] || "—"}</span>
                )}
              </div>
            ))}
        </div>
      )}

      {/* System Risks */}
      {decisions.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> System Risks
          </p>
          {decisions.map((d, i) => (
            <div key={i} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11px] ${
              d.type === "risk" ? "bg-red-500/5 text-red-400" :
              d.type === "action" ? "bg-amber-500/5 text-amber-400" :
              "bg-muted/20 text-muted-foreground"
            }`}>
              <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
              <span>{d.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* Recent Wins */}
      {recentDone.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
            <Trophy className="h-3 w-3" /> Recent Wins
          </p>
          {recentDone.slice(0, 3).map(t => (
            <div key={t.id} className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-emerald-500/5 text-[11px]">
              <Star className="h-2.5 w-2.5 text-emerald-400 shrink-0" />
              <span className="truncate flex-1">{t.title}</span>
              <span className="text-muted-foreground/60 text-[9px] shrink-0">
                {t.completed_at ? format(new Date(t.completed_at), "MMM d") : ""}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Learning Progress */}
      <div className="space-y-1 pt-2 border-t border-border/20">
        <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
          <Brain className="h-3 w-3" /> Learning Progress
        </p>
        <div className="flex gap-2 flex-wrap">
          {Object.entries(memPerAgent).slice(0, 5).map(([agentId, count]) => (
            <div key={agentId} className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-muted/30">
              <span>{agentMap[agentId] || agentId}</span>
              <span className="font-mono text-primary">{count}</span>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground/60">
          {memories?.length || 0} total learnings • {assignments?.length || 0} assignments
        </p>
      </div>
    </div>
  );
}
