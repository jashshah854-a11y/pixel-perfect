import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Activity, AlertTriangle, Zap, Clock, TrendingUp, CheckCircle2, XCircle, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";

interface HealthMetric {
  label: string;
  value: number | string;
  status: "healthy" | "warning" | "critical";
  icon: typeof Activity;
}

export function SystemHealthPanel() {
  const [failureLog, setFailureLog] = useState<Array<{
    id: string;
    taskTitle: string;
    agentName: string;
    reason: string;
    resolved: boolean;
    timestamp: number;
  }>>([]);

  const { data: agents } = useQuery({
    queryKey: ["agents"],
    queryFn: async () => {
      const { data } = await supabase.from("agents").select("*");
      return data || [];
    },
  });

  const { data: tasks } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data } = await supabase.from("tasks").select("*");
      return data || [];
    },
  });

  const { data: assignments } = useQuery({
    queryKey: ["task-assignments"],
    queryFn: async () => {
      const { data } = await supabase.from("task_assignments").select("*").order("claimed_at", { ascending: false }).limit(50);
      return data || [];
    },
  });

  const { data: collabs } = useQuery({
    queryKey: ["agent-collaborations"],
    queryFn: async () => {
      const { data } = await supabase.from("agent_collaborations").select("*").order("created_at", { ascending: false }).limit(30);
      return data || [];
    },
  });

  const { data: externalActions } = useQuery({
    queryKey: ["external-actions"],
    queryFn: async () => {
      const { data } = await supabase.from("external_actions").select("*").order("created_at", { ascending: false }).limit(5);
      return data || [];
    },
  });
  // Simulate failure detection based on task states
  useEffect(() => {
    if (!tasks || !agents) return;
    const blocked = tasks.filter(t => t.status === "blocked");
    const newFailures = blocked
      .filter(t => !failureLog.some(f => f.id === t.id))
      .map(t => ({
        id: t.id,
        taskTitle: t.title,
        agentName: agents.find(a => a.id === t.assigned_to)?.name || "Unassigned",
        reason: "Task blocked — awaiting resolution",
        resolved: false,
        timestamp: Date.now(),
      }));
    if (newFailures.length > 0) {
      setFailureLog(prev => [...newFailures, ...prev].slice(0, 10));
    }
  }, [tasks, agents]);

  const activeTasks = tasks?.filter(t => t.status === "in_progress").length || 0;
  const blockedTasks = tasks?.filter(t => t.status === "blocked").length || 0;
  const queuedTasks = tasks?.filter(t => t.status === "queued").length || 0;
  const workingAgents = agents?.filter(a => a.status === "working").length || 0;
  const idleAgents = agents?.filter(a => a.status === "idle").length || 0;
  const totalAgents = agents?.length || 0;
  const activeCollabs = collabs?.filter(c => c.status === "pending" || c.status === "in_progress").length || 0;

  const overloadThreshold = 2;
  const overloadedAgents = agents?.filter(a => {
    const agentTasks = assignments?.filter(as => as.agent_id === a.id && as.role === "owner").length || 0;
    return agentTasks > overloadThreshold;
  }).length || 0;

  const utilization = totalAgents > 0 ? Math.round((workingAgents / totalAgents) * 100) : 0;

  const metrics: HealthMetric[] = [
    {
      label: "Active Tasks",
      value: activeTasks,
      status: activeTasks > 0 ? "healthy" : "warning",
      icon: Zap,
    },
    {
      label: "Blocked",
      value: blockedTasks,
      status: blockedTasks === 0 ? "healthy" : blockedTasks > 2 ? "critical" : "warning",
      icon: AlertTriangle,
    },
    {
      label: "Queue",
      value: queuedTasks,
      status: queuedTasks > 5 ? "warning" : "healthy",
      icon: Clock,
    },
    {
      label: "Utilization",
      value: `${utilization}%`,
      status: utilization > 80 ? "warning" : utilization > 0 ? "healthy" : "warning",
      icon: TrendingUp,
    },
    {
      label: "Collabs",
      value: activeCollabs,
      status: "healthy",
      icon: Activity,
    },
  ];

  const statusColors = {
    healthy: "text-emerald-400",
    warning: "text-amber-400",
    critical: "text-red-400",
  };

  const statusBg = {
    healthy: "bg-emerald-500/10",
    warning: "bg-amber-500/10",
    critical: "bg-red-500/10",
  };

  const overallHealth = blockedTasks > 2 || overloadedAgents > 2
    ? "critical"
    : blockedTasks > 0 || overloadedAgents > 0
    ? "warning"
    : "healthy";

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className={`h-4 w-4 ${statusColors[overallHealth]}`} />
          <h3 className="text-sm font-semibold">System Health</h3>
          <div className={`h-2 w-2 rounded-full ${overallHealth === "healthy" ? "bg-emerald-400" : overallHealth === "warning" ? "bg-amber-400" : "bg-red-400"} animate-pulse`} />
        </div>
        <span className="text-[10px] text-muted-foreground font-mono">
          {workingAgents}/{totalAgents} active • {idleAgents} idle
        </span>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-5 gap-2">
        {metrics.map(m => {
          const Icon = m.icon;
          return (
            <div
              key={m.label}
              className={`rounded-md p-2 text-center ${statusBg[m.status]} border border-border/20`}
            >
              <Icon className={`h-3 w-3 mx-auto mb-1 ${statusColors[m.status]}`} />
              <p className="text-sm font-bold font-mono">{m.value}</p>
              <p className="text-[9px] text-muted-foreground">{m.label}</p>
            </div>
          );
        })}
      </div>

      {/* Overloaded Agents Warning */}
      {overloadedAgents > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>{overloadedAgents} agent{overloadedAgents > 1 ? "s" : ""} overloaded — consider redistributing work</span>
        </div>
      )}

      {/* Failure Log */}
      {failureLog.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
            <XCircle className="h-3 w-3 text-red-400" /> Failure Log
          </p>
          {failureLog.slice(0, 4).map(f => (
            <div key={f.id} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11px] ${
              f.resolved ? "bg-emerald-500/5 border border-emerald-500/15" : "bg-red-500/5 border border-red-500/15"
            }`}>
              {f.resolved ? (
                <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
              ) : (
                <RotateCcw className="h-3 w-3 text-red-400 shrink-0 animate-spin" style={{ animationDuration: "3s" }} />
              )}
              <span className="truncate">{f.taskTitle}</span>
              <span className="text-muted-foreground/60 ml-auto shrink-0">{f.agentName}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
