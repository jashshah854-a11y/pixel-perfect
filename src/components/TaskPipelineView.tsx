import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { StatusBadge } from "@/components/StatusBadge";

const statusMap: Record<string, string> = {
  Queued: "queued",
  Active: "in_progress",
  Done: "done",
  Blocked: "blocked",
};

export function TaskPipelineView() {
  const [openStage, setOpenStage] = useState<string | null>(null);

  const { data: tasks } = useQuery({
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

  const queued = allTasks.filter(t => t.status === "queued").length;
  const active = allTasks.filter(t => t.status === "in_progress").length;
  const done = allTasks.filter(t => t.status === "done").length;
  const blocked = allTasks.filter(t => t.status === "blocked").length;
  const total = allTasks.length;

  const stages = [
    { label: "Queued", count: queued, icon: Clock, color: "text-amber-400", barColor: "bg-amber-400" },
    { label: "Active", count: active, icon: Loader2, color: "text-blue-400", barColor: "bg-blue-400" },
    { label: "Done", count: done, icon: CheckCircle2, color: "text-emerald-400", barColor: "bg-emerald-400" },
    ...(blocked > 0 ? [{ label: "Blocked", count: blocked, icon: AlertCircle, color: "text-red-400", barColor: "bg-red-400" }] : []),
  ];

  const drawerTasks = openStage
    ? allTasks.filter(t => t.status === statusMap[openStage])
    : [];

  const openStageData = stages.find(s => s.label === openStage);

  return (
    <>
      <div className="surface-1 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-[0.2em] font-medium text-muted-foreground">
            Task Pipeline
          </span>
          <span className="text-[11px] text-mono tabular-nums text-muted-foreground/60">
            {total} total
          </span>
        </div>

        {total > 0 && (
          <div className="flex h-1.5 rounded-full overflow-hidden bg-white/[0.04]">
            {stages.map(s => s.count > 0 && (
              <div
                key={s.label}
                className={`${s.barColor} opacity-70 transition-all duration-500`}
                style={{ width: `${(s.count / total) * 100}%` }}
              />
            ))}
          </div>
        )}

        <div className="flex items-center gap-5">
          {stages.map(s => {
            const Icon = s.icon;
            return (
              <button
                key={s.label}
                onClick={() => setOpenStage(s.label)}
                className="flex items-center gap-2 rounded-lg px-2 py-1 -mx-2 -my-1 transition-colors hover:bg-white/[0.06] cursor-pointer"
              >
                <Icon className={`h-3.5 w-3.5 ${s.color} ${s.label === "Active" && s.count > 0 ? "animate-spin" : ""}`} />
                <div className="flex items-baseline gap-1.5">
                  <span className="stat-display text-lg font-semibold text-foreground tabular-nums">{s.count}</span>
                  <span className="text-[10px] text-muted-foreground">{s.label}</span>
                </div>
              </button>
            );
          })}
        </div>
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
