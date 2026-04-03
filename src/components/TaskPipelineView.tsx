import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, FileInput, Brain, Wand2, UserCheck, Play, FileOutput, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface PipelineStage {
  key: string;
  label: string;
  icon: typeof FileInput;
  color: string;
  count: number;
  items: { id: string; title: string; agent?: string }[];
}

export function TaskPipelineView() {
  const { data: tasks } = useQuery({
    queryKey: ["pipeline-tasks"],
    queryFn: async () => {
      const { data } = await supabase.from("tasks").select("*").order("created_at", { ascending: false }).limit(50);
      return data || [];
    },
    refetchInterval: 10000,
  });

  const { data: outputs } = useQuery({
    queryKey: ["pipeline-outputs"],
    queryFn: async () => {
      const { data } = await supabase.from("task_outputs").select("id, task_id, title, output_type").order("created_at", { ascending: false }).limit(20);
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
  const allOutputs = outputs || [];

  const outputTaskIds = new Set(allOutputs.map(o => o.task_id));

  const stages: PipelineStage[] = [
    {
      key: "input",
      label: "Input",
      icon: FileInput,
      color: "text-blue-400",
      count: allTasks.filter(t => t.status === "queued" && !t.assigned_to).length,
      items: allTasks.filter(t => t.status === "queued" && !t.assigned_to).slice(0, 3).map(t => ({ id: t.id, title: t.title })),
    },
    {
      key: "planning",
      label: "Planning",
      icon: Brain,
      color: "text-purple-400",
      count: allTasks.filter(t => t.source === "plan-decomposition" && t.status === "queued").length,
      items: allTasks.filter(t => t.source === "plan-decomposition" && t.status === "queued").slice(0, 3).map(t => ({ id: t.id, title: t.title })),
    },
    {
      key: "prompt",
      label: "Prompt Gen",
      icon: Wand2,
      color: "text-amber-400",
      count: allTasks.filter(t => t.status === "queued" && t.assigned_to).length,
      items: allTasks.filter(t => t.status === "queued" && t.assigned_to).slice(0, 3).map(t => ({ id: t.id, title: t.title, agent: agentMap[t.assigned_to || ""] })),
    },
    {
      key: "assigned",
      label: "Assigned",
      icon: UserCheck,
      color: "text-cyan-400",
      count: allTasks.filter(t => t.status === "in_progress" && t.assigned_to).length,
      items: allTasks.filter(t => t.status === "in_progress" && t.assigned_to).slice(0, 3).map(t => ({ id: t.id, title: t.title, agent: agentMap[t.assigned_to || ""] })),
    },
    {
      key: "executing",
      label: "Executing",
      icon: Play,
      color: "text-green-400",
      count: allTasks.filter(t => t.status === "in_progress").length,
      items: allTasks.filter(t => t.status === "in_progress").slice(0, 3).map(t => ({ id: t.id, title: t.title, agent: agentMap[t.assigned_to || ""] })),
    },
    {
      key: "output",
      label: "Output",
      icon: FileOutput,
      color: "text-orange-400",
      count: allTasks.filter(t => t.status === "done" && outputTaskIds.has(t.id)).length,
      items: allOutputs.slice(0, 3).map(o => ({ id: o.id, title: o.title })),
    },
    {
      key: "validated",
      label: "Validated",
      icon: CheckCircle,
      color: "text-emerald-400",
      count: allTasks.filter(t => t.status === "done").length,
      items: allTasks.filter(t => t.status === "done").slice(0, 3).map(t => ({ id: t.id, title: t.title })),
    },
  ];

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground">Task Pipeline</h3>

      {/* Pipeline flow */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {stages.map((stage, i) => {
          const Icon = stage.icon;
          const hasItems = stage.count > 0;
          return (
            <div key={stage.key} className="flex items-center shrink-0">
              <div className={`rounded-lg border p-2 min-w-[100px] transition-colors ${hasItems ? "border-border/40 bg-card/60" : "border-border/10 bg-card/20 opacity-50"}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon className={`h-3 w-3 ${stage.color}`} />
                  <span className="text-[10px] font-medium text-muted-foreground">{stage.label}</span>
                </div>
                <p className={`text-lg font-semibold font-mono tabular-nums ${hasItems ? "text-foreground" : "text-muted-foreground/50"}`}>
                  {stage.count}
                </p>
                {stage.items.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {stage.items.map(item => (
                      <p key={item.id} className="text-[8px] text-muted-foreground truncate max-w-[90px]">
                        {item.agent && <span className="text-primary/70">{item.agent}: </span>}
                        {item.title}
                      </p>
                    ))}
                  </div>
                )}
              </div>
              {i < stages.length - 1 && (
                <ArrowRight className={`h-3 w-3 mx-0.5 shrink-0 ${hasItems ? "text-muted-foreground/50" : "text-muted-foreground/20"}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
