import { StatusBadge } from "./StatusBadge";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle } from "lucide-react";

interface TaskCardProps {
  task: {
    id: string;
    title: string;
    assigned_to: string | null;
    priority: string;
    source: string;
    status: string;
  };
  agentName?: string;
}

export function TaskCard({ task, agentName }: TaskCardProps) {
  const queryClient = useQueryClient();

  const completeAndLearn = async () => {
    // Mark task done
    await supabase.from("tasks").update({
      status: "done",
      completed_at: new Date().toISOString(),
    }).eq("id", task.id);

    // Trigger learning
    try {
      await supabase.functions.invoke("agent-learn", { body: { task_id: task.id } });
      toast.success("Task completed — agents learning from it");
    } catch {
      toast.success("Task completed");
    }

    queryClient.invalidateQueries({ queryKey: ["tasks"] });
    queryClient.invalidateQueries({ queryKey: ["agents"] });
    queryClient.invalidateQueries({ queryKey: ["agent-memory"] });
  };

  return (
    <div className="rounded-lg border bg-card p-3 space-y-2">
      <p className="text-sm font-medium">{task.title}</p>
      <div className="flex flex-wrap gap-1.5">
        <StatusBadge value={task.priority} />
        <StatusBadge value={task.source} />
      </div>
      {agentName && (
        <p className="text-xs text-muted-foreground">→ {agentName}</p>
      )}
      {task.status !== "done" && (
        <button
          onClick={completeAndLearn}
          className="flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300 mt-1"
        >
          <CheckCircle className="h-3 w-3" />
          Complete & Learn
        </button>
      )}
    </div>
  );
}
