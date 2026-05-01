import { StatusBadge } from "./StatusBadge";
import { TaskOutputViewer } from "./TaskOutputViewer";
import { IntentPreview } from "./IntentPreview";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle, Brain, ChevronDown, ChevronUp } from "lucide-react";

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
  expandedIntentId?: string | null;
  onToggleIntent?: (id: string | null) => void;
  agentMap?: Record<string, string>;
}

export function TaskCard({ task, agentName, expandedIntentId, onToggleIntent, agentMap }: TaskCardProps) {
  const queryClient = useQueryClient();
  const isIntentOpen = expandedIntentId === task.id;

  const completeAndLearn = async () => {
    await supabase.from("tasks").update({
      status: "done",
      completed_at: new Date().toISOString(),
    }).eq("id", task.id);

    const [execResult, learnResult] = await Promise.allSettled([
      supabase.functions.invoke("agent-execute", { body: { task_id: task.id } }),
      supabase.functions.invoke("agent-learn", { body: { task_id: task.id } }),
    ]);

    const execOk = execResult.status === "fulfilled" && !execResult.value.error;
    const learnOk = learnResult.status === "fulfilled" && !learnResult.value.error;

    if (execOk && learnOk) {
      toast.success("Task completed — code generated & agents learning");
    } else if (execOk) {
      toast.success("Task completed — code generated");
    } else {
      const outputContent = [
        `## Task: ${task.title}`,
        task.description ? `\n### Description\n${task.description}` : "",
        `\n### Execution Summary`,
        `- **Status**: Completed`,
        `- **Priority**: ${task.priority}`,
        agentName ? `- **Handled by**: ${agentName}` : "",
        `- **Completed at**: ${new Date().toLocaleString()}`,
      ].filter(Boolean).join("\n");

      await supabase.from("task_outputs").insert({
        task_id: task.id,
        title: `${task.title} — Report`,
        content: outputContent,
        output_type: "report",
        format: "markdown",
      });
      toast.success("Task completed — report generated");
    }

    queryClient.invalidateQueries({ queryKey: ["tasks"] });
    queryClient.invalidateQueries({ queryKey: ["agents"] });
    queryClient.invalidateQueries({ queryKey: ["agent-memory"] });
    queryClient.invalidateQueries({ queryKey: ["task-outputs", task.id] });
  };

  return (
    <div className="interactive-card p-3.5 space-y-2.5 group">
      <p className="text-sm font-medium leading-snug group-hover:text-foreground transition-colors duration-fast">
        {task.title}
      </p>

      <div className="flex items-center gap-1.5 flex-wrap">
        <StatusBadge value={task.priority} />
        <StatusBadge value={task.source} />
        {agentName && (
          <span className="text-[10px] text-muted-foreground/80 flex items-center gap-1 ml-auto">
            <span className="h-1 w-1 rounded-full bg-primary/60" />
            {agentName}
          </span>
        )}
      </div>

      {/* Actions row */}
      <div className="flex items-center gap-3">
        {task.status !== "done" && (
          <button
            onClick={completeAndLearn}
            className="flex items-center gap-1 text-[10px] font-medium text-status-working hover:text-status-working/80 press-effect transition-colors duration-fast"
          >
            <CheckCircle className="h-3 w-3" />
            Complete
          </button>
        )}
        {task.assigned_to && task.status === "in_progress" && onToggleIntent && (
          <button
            onClick={() => onToggleIntent(isIntentOpen ? null : task.id)}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors ml-auto"
          >
            <Brain className="h-2.5 w-2.5" />
            Intent
            {isIntentOpen ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
          </button>
        )}
      </div>

      {/* Inline Intent Preview */}
      {isIntentOpen && agentMap && (
        <div className="animate-fade-in">
          <IntentPreview taskId={task.id} agentMap={agentMap} />
        </div>
      )}

      <TaskOutputViewer taskId={task.id} taskTitle={task.title} isCompleted={task.status === "done"} />
    </div>
  );
}
