import { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Inbox } from "lucide-react";

interface SkeletonListProps {
  /** Number of skeleton rows to render. */
  rows?: number;
  /** Tailwind height class for each row. */
  rowHeight?: string;
  /** Layout: vertical stack or grid. */
  variant?: "stack" | "grid-2" | "grid-3";
}

/**
 * Unified loading skeleton list. Use directly under PageHeader-controlled regions.
 */
export function SkeletonList({ rows = 4, rowHeight = "h-16", variant = "stack" }: SkeletonListProps) {
  const wrap =
    variant === "grid-3"
      ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3"
      : variant === "grid-2"
        ? "grid grid-cols-1 md:grid-cols-2 gap-3"
        : "space-y-2";
  return (
    <div className={wrap} aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className={`${rowHeight} rounded-lg`} />
      ))}
    </div>
  );
}

interface EmptyStateProps {
  /** Short editorial title. */
  title: string;
  /** Optional supporting copy. */
  description?: ReactNode;
  /** Optional icon override (defaults to Inbox). */
  icon?: ReactNode;
  /** Optional CTA / actions. */
  action?: ReactNode;
}

/**
 * Cinematic empty state. Hairline-dashed surface, mono eyebrow, display title.
 */
export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <div className="empty-state flex flex-col items-center justify-center gap-2.5 !py-10">
      <div className="text-muted-foreground/50">
        {icon ?? <Inbox className="h-5 w-5" />}
      </div>
      <p className="text-[10px] text-mono uppercase tracking-[0.22em] text-muted-foreground/60">
        Empty
      </p>
      <p className="text-display text-sm font-medium text-foreground/80">{title}</p>
      {description && (
        <p className="text-[12px] text-muted-foreground max-w-sm text-center leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}
