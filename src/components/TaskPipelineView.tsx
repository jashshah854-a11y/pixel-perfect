import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, Clock, AlertCircle, Sparkles } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { StatusBadge } from "@/components/StatusBadge";

const statusMap: Record<string, string> = {
  Queued: "queued",
  Active: "in_progress",
  Done: "done",
  Blocked: "blocked",
};

type FilterMode = "all" | "assigned";

export function TaskPipelineView() {
  const [openStage, setOpenStage] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterMode>("all");

  const { data: tasks, isFetching } = useQuery({
    queryKey: ["pipeline-tasks"],
    queryFn: async () => {
      const { data } = await supabase.from("tasks").select("*").order("created_at", { ascending: false }).limit(50);
      return data || [];
    },
    refetchInterval: 10000,
  });

  const { data: agents } = useQuery({
    queryKey: ["pipeline-agents"],
    queryFn: async () => {
      const { data } = await supabase.from("agents").select("id, name");
      return data || [];
    },
  });

  const agentMap = Object.fromEntries((agents || []).map(a => [a.id, a.name]));
  const allTasks = tasks || [];

  const visibleTasks = filter === "assigned"
    ? allTasks.filter(t => t.assigned_to)
    : allTasks;

  const queued = visibleTasks.filter(t => t.status === "queued").length;
  const active = visibleTasks.filter(t => t.status === "in_progress").length;
  const done = visibleTasks.filter(t => t.status === "done").length;
  const blocked = visibleTasks.filter(t => t.status === "blocked").length;
  const total = visibleTasks.length;

  const stages = [
    { label: "Queued", count: queued, icon: Clock, color: "text-amber-400", barColor: "bg-amber-400" },
    { label: "Active", count: active, icon: Loader2, color: "text-blue-400", barColor: "bg-blue-400" },
    { label: "Done", count: done, icon: CheckCircle2, color: "text-emerald-400", barColor: "bg-emerald-400" },
    ...(blocked > 0 ? [{ label: "Blocked", count: blocked, icon: AlertCircle, color: "text-red-400", barColor: "bg-red-400" }] : []),
  ];

  const drawerTasks = openStage
    ? visibleTasks.filter(t => t.status === statusMap[openStage])
    : [];

  const openStageData = stages.find(s => s.label === openStage);

  return (
    <>
      <div className="surface-1 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-[0.2em] font-medium text-muted-foreground">
            Task Pipeline
          </span>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg bg-white/[0.04] p-0.5">
              {(["all", "assigned"] as FilterMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setFilter(mode)}
                  className={`text-[10px] px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                    filter === mode
                      ? "bg-white/[0.12] text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground/80"
                  }`}
                >
                  {mode === "all" ? "All" : "Assigned"}
                </button>
              ))}
            </div>
            <span className="text-[11px] text-mono tabular-nums text-muted-foreground/60">
              {total} total
            </span>
          </div>
        </div>

        {isFetching ? (
          <div className="space-y-3 animate-pulse">
            <div className="flex h-1.5 rounded-full overflow-hidden bg-white/[0.04]">
              <div className="h-full w-1/4 bg-white/[0.06]" />
              <div className="h-full w-1/4 bg-white/[0.06]" />
              <div className="h-full w-1/4 bg-white/[0.06]" />
              <div className="h-full w-1/4 bg-white/[0.06]" />
            </div>
            <div className="flex items-center gap-5">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-2 px-2 py-1">
                  <div className="h-3.5 w-3.5 rounded-full bg-white/[0.06]" />
                  <div className="flex items-baseline gap-1.5">
                    <div className="h-5 w-5 rounded bg-white/[0.06]" />
                    <div className="h-3 w-8 rounded bg-white/[0.06]" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : total === 0 ? (
          <div className="py-6 flex flex-col items-center justify-center gap-3 text-center">
            <div className="h-10 w-10 rounded-full bg-white/[0.04] flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-muted-foreground/50" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">No tasks yet</p>
              <p className="text-[11px] text-muted-foreground/60 max-w-[240px] leading-relaxed">
                Tasks appear when your agents run jobs or when you create a plan.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex h-1.5 rounded-full overflow-hidden bg-white/[0.04]">
              {stages.map(s => s.count > 0 && (
                <div
                  key={s.label}
                  className={`${s.barColor} opacity-70 transition-all duration-500`}
                  style={{ width: `${(s.count / total) * 100}%` }}
                />
              ))}
            </div>

            <div className="flex items-center gap-5">
              {stages.map(s => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.label}
                    onClick={() => setOpenStage(s.label)}
                    className="flex items-center gap-2 rounded-lg px-2 py-1 -mx-2 -my-1 transition-colors hover:bg-white/[0.06] cursor-pointer"
                  >
                    <Icon className={`h-3.5 w-3.5 ${s.color} ${s.label === "Active" && s.count > 1 ? "animate-spin" : ""}`} />
                    <div className="flex items-baseline gap-1.5">
                      <span className="stat-display text-lg font-semibold text-foreground tabular-nums">{s.count}</span>
                      <span className="text-[10px] text-muted-foreground">{s.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      <Sheet open={!!openStage} onOpenChange={(open) => !open && setOpenStage(null)}>
        <SheetContent className="bg-background/95 backdrop-blur-xl border-white/[0.06] w-[380px] sm:w-[420px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 text-foreground">
              {openStageData && (
                <openStageData.icon className={`h-4 w-4 ${openStageData.color}`} />
              )}
              {openStage} Tasks
              <span className="text-mono text-sm text-muted-foreground tabular-nums">
                ({drawerTasks.length})
              </span>
            </SheetTitle>
          </SheetHeader>

          <div className="mt-4 space-y-2 overflow-y-auto max-h-[calc(100vh-120px)] pr-1">
            {drawerTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground/60 text-center py-8">
                No tasks in this stage
              </p>
            ) : (
              drawerTasks.map(task => (
                <div
                  key={task.id}
                  className="surface-2 rounded-lg p-3 space-y-1.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-foreground leading-snug">
                      {task.title}
                    </p>
                    <StatusBadge value={task.priority || "medium"} type="priority" />
                  </div>
                  {task.description && (
                    <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                      {task.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground/70">
                    {task.assigned_to && agentMap[task.assigned_to] && (
                      <span className="text-primary/80 font-medium">
                        {agentMap[task.assigned_to]}
                      </span>
                    )}
                    {task.created_at && (
                      <span className="text-mono tabular-nums">
                        {new Date(task.created_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
