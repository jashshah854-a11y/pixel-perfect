import { StatusBadge } from "./StatusBadge";

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
    </div>
  );
}
