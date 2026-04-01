import { cn } from "@/lib/utils";

type BadgeType = "status" | "priority" | "verdict" | "type" | "department" | "source";

interface StatusBadgeProps {
  value: string;
  type?: BadgeType;
  className?: string;
}

const colorMap: Record<string, string> = {
  // Agent status
  idle: "bg-muted text-muted-foreground",
  working: "bg-green-500/15 text-green-400",
  paused: "bg-yellow-500/15 text-yellow-400",
  offline: "bg-red-500/15 text-red-400",
  // Task status
  queued: "bg-muted text-muted-foreground",
  in_progress: "bg-blue-500/15 text-blue-400",
  done: "bg-green-500/15 text-green-400",
  blocked: "bg-red-500/15 text-red-400",
  // Priority
  low: "bg-muted text-muted-foreground",
  medium: "bg-yellow-500/15 text-yellow-400",
  high: "bg-orange-500/15 text-orange-400",
  urgent: "bg-red-500/15 text-red-400",
  // Verdict
  apply: "bg-green-500/15 text-green-400",
  maybe: "bg-yellow-500/15 text-yellow-400",
  skip: "bg-muted text-muted-foreground",
  // Plan status
  draft: "bg-muted text-muted-foreground",
  approved: "bg-blue-500/15 text-blue-400",
  executing: "bg-yellow-500/15 text-yellow-400",
  // Inbox type
  critique: "bg-orange-500/15 text-orange-400",
  question: "bg-blue-500/15 text-blue-400",
  update: "bg-green-500/15 text-green-400",
  alert: "bg-red-500/15 text-red-400",
  // Source
  manual: "bg-muted text-muted-foreground",
  agent: "bg-purple-500/15 text-purple-400",
};

export function StatusBadge({ value, className }: StatusBadgeProps) {
  const colors = colorMap[value] || "bg-muted text-muted-foreground";
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize", colors, className)}>
      {value.replace("_", " ")}
    </span>
  );
}
