import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, Clock, AlertCircle } from "lucide-react";

export function TaskPipelineView() {
  const { data: tasks } = useQuery({
    queryKey: ["pipeline-tasks"],
    queryFn: async () => {
      const { data } = await supabase.from("tasks").select("*").order("created_at", { ascending: false }).limit(50);
      return data || [];
    },
    refetchInterval: 10000,
  });

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

  return (
    <div className="surface-1 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.2em] font-medium text-muted-foreground">
          Task Pipeline
        </span>
        <span className="text-[11px] text-mono tabular-nums text-muted-foreground/60">
          {total} total
        </span>
      </div>

      {/* Progress bar */}
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

      {/* Stage counts */}
      <div className="flex items-center gap-5">
        {stages.map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="flex items-center gap-2">
              <Icon className={`h-3.5 w-3.5 ${s.color} ${s.label === "Active" && s.count > 0 ? "animate-spin" : ""}`} />
              <div className="flex items-baseline gap-1.5">
                <span className="stat-display text-lg font-semibold text-foreground tabular-nums">{s.count}</span>
                <span className="text-[10px] text-muted-foreground">{s.label}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
