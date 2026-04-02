import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { BarChart3, TrendingUp, Clock, Zap, CheckCircle, AlertTriangle, Users, FileText } from "lucide-react";
import { format, differenceInHours, subDays } from "date-fns";

export default function AnalyticsPage() {
  const { data: tasks } = useQuery({
    queryKey: ["analytics-tasks"],
    queryFn: async () => {
      const { data } = await supabase.from("tasks").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: agents } = useQuery({
    queryKey: ["analytics-agents"],
    queryFn: async () => {
      const { data } = await supabase.from("agents").select("*");
      return data || [];
    },
  });

  const { data: assignments } = useQuery({
    queryKey: ["analytics-assignments"],
    queryFn: async () => {
      const { data } = await supabase.from("task_assignments").select("*");
      return data || [];
    },
  });

  const { data: outputs } = useQuery({
    queryKey: ["analytics-outputs"],
    queryFn: async () => {
      const { data } = await supabase.from("task_outputs").select("*");
      return data || [];
    },
  });

  const { data: memories } = useQuery({
    queryKey: ["analytics-memories"],
    queryFn: async () => {
      const { data } = await supabase.from("agent_memory").select("*");
      return data || [];
    },
  });

  const { data: inbox } = useQuery({
    queryKey: ["analytics-inbox-unread"],
    queryFn: async () => {
      const { data } = await supabase.from("inbox").select("id").eq("read", false);
      return data || [];
    },
  });

  const totalTokens = agents?.reduce((s, a) => s + a.tokens_used, 0) || 0;
  const allTasks = tasks || [];
  const doneTasks = allTasks.filter(t => t.status === "done");
  const inProgressTasks = allTasks.filter(t => t.status === "in_progress");
  const blockedTasks = allTasks.filter(t => t.status === "blocked");
  const completionRate = allTasks.length ? ((doneTasks.length / allTasks.length) * 100).toFixed(1) : "0";

  // Avg completion time
  const completionTimes = doneTasks
    .filter(t => t.completed_at)
    .map(t => differenceInHours(new Date(t.completed_at!), new Date(t.created_at)));
  const avgCompletionHours = completionTimes.length
    ? (completionTimes.reduce((s, h) => s + h, 0) / completionTimes.length).toFixed(1)
    : "—";

  // Agent efficiency: tasks completed per agent
  const agentStats = (agents || []).map(a => {
    const agentTasks = allTasks.filter(t => t.assigned_to === a.id);
    const agentDone = agentTasks.filter(t => t.status === "done").length;
    const agentAssignments = (assignments || []).filter(as => as.agent_id === a.id);
    const avgFitScore = agentAssignments.length
      ? (agentAssignments.reduce((s, as) => s + as.fit_score, 0) / agentAssignments.length).toFixed(0)
      : "—";
    const agentMemories = (memories || []).filter(m => m.agent_id === a.id).length;
    return { ...a, totalTasks: agentTasks.length, done: agentDone, avgFitScore, memories: agentMemories };
  }).sort((a, b) => b.done - a.done);

  // Recent 7 days task creation trend
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const day = subDays(new Date(), 6 - i);
    const dayStr = format(day, "yyyy-MM-dd");
    const created = allTasks.filter(t => t.created_at.startsWith(dayStr)).length;
    const completed = doneTasks.filter(t => t.completed_at?.startsWith(dayStr)).length;
    return { label: format(day, "EEE"), created, completed };
  });
  const maxBar = Math.max(...last7.map(d => Math.max(d.created, d.completed)), 1);

  // Output stats
  const totalOutputs = outputs?.length || 0;
  const outputsByType: Record<string, number> = {};
  for (const o of outputs || []) {
    outputsByType[o.output_type] = (outputsByType[o.output_type] || 0) + 1;
  }

  // Priority distribution
  const priorityCounts: Record<string, number> = {};
  for (const t of allTasks) {
    priorityCounts[t.priority] = (priorityCounts[t.priority] || 0) + 1;
  }

  return (
    <Layout totalTokens={totalTokens} unreadCount={inbox?.length || 0}>
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">System Analytics</h2>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total Tasks", value: allTasks.length, icon: FileText, color: "text-primary" },
            { label: "Completion Rate", value: `${completionRate}%`, icon: CheckCircle, color: "text-emerald-400" },
            { label: "Avg Completion", value: `${avgCompletionHours}h`, icon: Clock, color: "text-amber-400" },
            { label: "Active / Blocked", value: `${inProgressTasks.length} / ${blockedTasks.length}`, icon: AlertTriangle, color: "text-orange-400" },
          ].map((kpi) => (
            <div key={kpi.label} className="rounded-xl border border-border/30 bg-card/60 p-4 space-y-1">
              <div className="flex items-center gap-2">
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                <span className="text-xs text-muted-foreground">{kpi.label}</span>
              </div>
              <p className="text-2xl font-semibold font-mono tabular-nums">{kpi.value}</p>
            </div>
          ))}
        </div>

        {/* 7-day trend */}
        <div className="rounded-xl border border-border/30 bg-card/60 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-medium">7-Day Activity</h3>
          </div>
          <div className="flex items-end gap-2 h-28">
            {last7.map((day, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex gap-0.5 items-end justify-center h-20">
                  <div
                    className="w-3 rounded-t bg-primary/60 transition-all"
                    style={{ height: `${(day.created / maxBar) * 100}%`, minHeight: day.created ? 4 : 0 }}
                    title={`${day.created} created`}
                  />
                  <div
                    className="w-3 rounded-t bg-emerald-500/60 transition-all"
                    style={{ height: `${(day.completed / maxBar) * 100}%`, minHeight: day.completed ? 4 : 0 }}
                    title={`${day.completed} completed`}
                  />
                </div>
                <span className="text-[9px] text-muted-foreground">{day.label}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-4 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-primary/60" /> Created</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-500/60" /> Completed</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Agent Efficiency */}
          <div className="rounded-xl border border-border/30 bg-card/60 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-medium">Agent Efficiency</h3>
            </div>
            <div className="space-y-2">
              {agentStats.map(a => (
                <div key={a.id} className="flex items-center gap-3 text-xs">
                  <span className="w-20 truncate font-medium">{a.name}</span>
                  <div className="flex-1 h-2 bg-muted/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${a.totalTasks ? (a.done / a.totalTasks) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-muted-foreground font-mono w-12 text-right">{a.done}/{a.totalTasks}</span>
                  <span className="text-muted-foreground font-mono w-10 text-right">fit:{a.avgFitScore}</span>
                  <span className="text-muted-foreground font-mono w-8 text-right">{a.memories}m</span>
                </div>
              ))}
            </div>
          </div>

          {/* Output & Priority */}
          <div className="space-y-4">
            <div className="rounded-xl border border-border/30 bg-card/60 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-medium">Outputs</h3>
                <span className="text-xs text-muted-foreground ml-auto">{totalOutputs} total</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {Object.entries(outputsByType).map(([type, count]) => (
                  <span key={type} className="text-xs px-2 py-1 rounded-md bg-primary/10 text-primary capitalize">
                    {type}: {count}
                  </span>
                ))}
                {totalOutputs === 0 && <span className="text-xs text-muted-foreground">No outputs yet</span>}
              </div>
            </div>

            <div className="rounded-xl border border-border/30 bg-card/60 p-4 space-y-3">
              <h3 className="text-sm font-medium">Priority Distribution</h3>
              <div className="flex gap-2 flex-wrap">
                {["low", "medium", "high", "urgent"].map(p => (
                  <span key={p} className={`text-xs px-2 py-1 rounded-md capitalize ${
                    p === "urgent" ? "bg-red-500/10 text-red-400" :
                    p === "high" ? "bg-orange-500/10 text-orange-400" :
                    p === "medium" ? "bg-amber-500/10 text-amber-400" :
                    "bg-muted/20 text-muted-foreground"
                  }`}>
                    {p}: {priorityCounts[p] || 0}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
