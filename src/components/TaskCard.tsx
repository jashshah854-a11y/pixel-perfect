import { StatusBadge } from "./StatusBadge";
import { TaskOutputViewer } from "./TaskOutputViewer";
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
    description?: string | null;
  };
  agentName?: string;
}

export function TaskCard({ task, agentName }: TaskCardProps) {
  const queryClient = useQueryClient();

  const completeAndLearn = async () => {
    await supabase.from("tasks").update({
      status: "done",
      completed_at: new Date().toISOString(),
    }).eq("id", task.id);

    // Auto-generate output
    const outputContent = [
      `## Task: ${task.title}`,
      task.description ? `\n### Description\n${task.description}` : "",
      `\n### Execution Summary`,
      `- **Status**: Completed`,
      `- **Priority**: ${task.priority}`,
      `- **Source**: ${task.source}`,
      agentName ? `- **Handled by**: ${agentName}` : "",
      `- **Completed at**: ${new Date().toLocaleString()}`,
      `\n### Outcome`,
      `Task executed and completed successfully. Learnings extracted and stored in agent memory.`,
    ].filter(Boolean).join("\n");

    await supabase.from("task_outputs").insert({
      task_id: task.id,
      title: `${task.title} — Report`,
      content: outputContent,
      output_type: "report",
      format: "markdown",
    });

    try {
      await supabase.functions.invoke("agent-learn", { body: { task_id: task.id } });
      toast.success("Task completed — output generated & agents learning");
    } catch {
      toast.success("Task completed — output generated");
    }

    queryClient.invalidateQueries({ queryKey: ["tasks"] });
    queryClient.invalidateQueries({ queryKey: ["agents"] });
    queryClient.invalidateQueries({ queryKey: ["agent-memory"] });
    queryClient.invalidateQueries({ queryKey: ["task-outputs", task.id] });
  };

  return (
    <div className="interactive-card p-4 space-y-3 group">
      <p className="text-sm font-medium leading-snug group-hover:text-foreground transition-colors duration-fast">
        {task.title}
      </p>
      <div className="flex flex-wrap gap-1.5">
        <StatusBadge value={task.priority} />
        <StatusBadge value={task.source} />
      </div>
      {agentName && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <span className="h-1 w-1 rounded-full bg-primary/60" />
          {agentName}
        </p>
      )}
      {task.status !== "done" && (
        <button
          onClick={completeAndLearn}
          className="flex items-center gap-1.5 text-[11px] font-medium text-status-working hover:text-status-working/80 press-effect mt-1 transition-colors duration-fast"
        >
          <CheckCircle className="h-3.5 w-3.5" />
          Complete & Learn
        </button>
      )}
      <TaskOutputViewer taskId={task.id} taskTitle={task.title} isCompleted={task.status === "done"} />
    </div>
  );
}
