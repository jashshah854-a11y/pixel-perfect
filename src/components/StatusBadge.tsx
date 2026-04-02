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
  working: "bg-status-working/15 text-status-working",
  paused: "bg-yellow-500/15 text-yellow-400",
  offline: "bg-status-blocked/15 text-status-blocked",
  // Task status
  queued: "bg-muted text-muted-foreground",
  in_progress: "bg-status-queued/15 text-status-queued",
  done: "bg-status-working/15 text-status-working",
  blocked: "bg-status-blocked/15 text-status-blocked",
  // Priority
  low: "bg-muted text-muted-foreground",
  medium: "bg-yellow-500/15 text-yellow-400",
  high: "bg-orange-500/15 text-orange-400",
  urgent: "bg-status-blocked/15 text-status-blocked",
  // Verdict
  apply: "bg-status-working/15 text-status-working",
  maybe: "bg-yellow-500/15 text-yellow-400",
  skip: "bg-muted text-muted-foreground",
  // Plan status
  draft: "bg-muted text-muted-foreground",
  approved: "bg-status-queued/15 text-status-queued",
  executing: "bg-yellow-500/15 text-yellow-400",
  // Inbox type
  critique: "bg-orange-500/15 text-orange-400",
  question: "bg-status-queued/15 text-status-queued",
  update: "bg-status-working/15 text-status-working",
  alert: "bg-status-blocked/15 text-status-blocked",
  // Source
  manual: "bg-muted text-muted-foreground",
  agent: "bg-purple-500/15 text-purple-400",
};

export function StatusBadge({ value, className }: StatusBadgeProps) {
  const colors = colorMap[value] || "bg-muted text-muted-foreground";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize tracking-wide badge-glow",
        colors,
        className
      )}
    >
      {value.replace("_", " ")}
    </span>
  );
}
