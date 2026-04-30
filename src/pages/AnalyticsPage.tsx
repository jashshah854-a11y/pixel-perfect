import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/PageHeader";
import { TrendingUp, Clock, Zap, CheckCircle, AlertTriangle, Users, FileText } from "lucide-react";
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
      <div className="space-y-6 max-w-6xl mx-auto p-1">
        <PageHeader
          eyebrow="Telemetry · Live"
          title="System Analytics"
          description="Throughput, completion velocity, and agent fitness across the autonomous fleet."
        />

        {/* KPI Cards — editorial display numerals */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total Tasks",      value: allTasks.length,                                            icon: FileText,       tone: "default" },
            { label: "Completion Rate",  value: `${completionRate}%`,                                       icon: CheckCircle,    tone: "positive" },
            { label: "Avg Completion",   value: `${avgCompletionHours}h`,                                   icon: Clock,          tone: "warn" },
            { label: "Active / Blocked", value: `${inProgressTasks.length} / ${blockedTasks.length}`,       icon: AlertTriangle,  tone: "default" },
          ].map((kpi) => {
            const toneStyle =
              kpi.tone === "positive" ? { color: "oklch(72% 0.18 155)" } :
              kpi.tone === "warn"     ? { color: "oklch(74% 0.18 65)" } :
                                        undefined;
            return (
              <div key={kpi.label} className="surface-2 rounded-xl p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <kpi.icon className="h-3 w-3" style={toneStyle ?? { color: "hsl(var(--primary))" }} />
                  <span className="text-[9.5px] uppercase tracking-[0.18em] font-medium text-muted-foreground">
                    {kpi.label}
                  </span>
                </div>
                <div className="hairline mb-2 opacity-50" />
                <p className="stat-display text-3xl font-semibold leading-none" style={toneStyle}>
                  {kpi.value}
                </p>
              </div>
            );
          })}
        </div>

        {/* 7-day trend */}
        <div className="surface-2 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-3 w-3 text-primary" />
            <span className="text-[10px] uppercase tracking-[0.2em] font-medium text-muted-foreground">7-Day Activity</span>
          </div>
          <div className="flex items-end gap-2 h-28">
            {last7.map((day, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                <div className="w-full flex gap-0.5 items-end justify-center h-20">
                  <div
                    className="w-3 rounded-t-sm transition-all duration-500"
                    style={{
                      height: `${(day.created / maxBar) * 100}%`,
                      minHeight: day.created ? 4 : 0,
                      background: "linear-gradient(180deg, oklch(70% 0.18 250) 0%, oklch(48% 0.20 252) 100%)",
                    }}
                    title={`${day.created} created`}
                  />
                  <div
                    className="w-3 rounded-t-sm transition-all duration-500"
                    style={{
                      height: `${(day.completed / maxBar) * 100}%`,
                      minHeight: day.completed ? 4 : 0,
                      background: "linear-gradient(180deg, oklch(72% 0.18 155) 0%, oklch(50% 0.20 155) 100%)",
                    }}
                    title={`${day.completed} completed`}
                  />
                </div>
                <span className="text-[9px] text-mono uppercase tracking-wider text-muted-foreground/70">{day.label}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-4 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm" style={{ background: "oklch(70% 0.18 250)" }} /> Created
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm" style={{ background: "oklch(72% 0.18 155)" }} /> Completed
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Agent Efficiency */}
          <div className="surface-2 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Users className="h-3 w-3 text-primary" />
              <span className="text-[10px] uppercase tracking-[0.2em] font-medium text-muted-foreground">Agent Efficiency</span>
            </div>
            <div className="space-y-2">
              {agentStats.map(a => (
                <div key={a.id} className="flex items-center gap-3 text-[11px]">
                  <span className="w-20 truncate font-medium">{a.name}</span>
                  <div className="flex-1 h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${a.totalTasks ? (a.done / a.totalTasks) * 100 : 0}%`,
                        background: "linear-gradient(90deg, oklch(70% 0.18 250) 0%, oklch(72% 0.22 250) 100%)",
                      }}
                    />
                  </div>
                  <span className="text-muted-foreground text-mono tabular-nums w-12 text-right">{a.done}/{a.totalTasks}</span>
                  <span className="text-muted-foreground text-mono tabular-nums w-10 text-right">fit:{a.avgFitScore}</span>
                  <span className="text-muted-foreground text-mono tabular-nums w-8 text-right">{a.memories}m</span>
                </div>
              ))}
            </div>
          </div>

          {/* Output & Priority */}
          <div className="space-y-4">
            <div className="surface-2 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Zap className="h-3 w-3 text-primary" />
                <span className="text-[10px] uppercase tracking-[0.2em] font-medium text-muted-foreground">Outputs</span>
                <span className="text-[10px] text-mono tabular-nums text-muted-foreground/60 ml-auto">{totalOutputs} total</span>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {Object.entries(outputsByType).map(([type, count]) => (
                  <span key={type} className="text-[11px] px-2 py-1 rounded-md bg-primary/10 text-primary capitalize border border-primary/15">
                    {type}: <span className="text-mono tabular-nums">{count}</span>
                  </span>
                ))}
                {totalOutputs === 0 && <span className="text-[11px] text-muted-foreground/60 italic">No outputs yet</span>}
              </div>
            </div>

            <div className="surface-2 rounded-xl p-4 space-y-3">
              <span className="text-[10px] uppercase tracking-[0.2em] font-medium text-muted-foreground">Priority Distribution</span>
              <div className="flex gap-1.5 flex-wrap">
                {["low", "medium", "high", "urgent"].map(p => {
                  const style =
                    p === "urgent" ? { background: "oklch(64% 0.22 25 / 0.12)", color: "oklch(74% 0.22 25)", borderColor: "oklch(64% 0.22 25 / 0.25)" } :
                    p === "high"   ? { background: "oklch(74% 0.18 65 / 0.12)", color: "oklch(80% 0.18 65)", borderColor: "oklch(74% 0.18 65 / 0.25)" } :
                    p === "medium" ? { background: "oklch(80% 0.15 100 / 0.12)", color: "oklch(86% 0.15 100)", borderColor: "oklch(80% 0.15 100 / 0.25)" } :
                                     { background: "oklch(50% 0.005 250 / 0.12)", color: "oklch(74% 0 0)", borderColor: "oklch(50% 0.005 250 / 0.25)" };
                  return (
                    <span key={p} className="text-[11px] px-2 py-1 rounded-md capitalize border" style={style}>
                      {p}: <span className="text-mono tabular-nums">{priorityCounts[p] || 0}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
