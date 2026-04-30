interface StatCardProps {
  label: string;
  value: number | string;
  delta?: string;
  tone?: "default" | "positive" | "negative" | "accent";
}

const toneClass: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default:  "text-foreground",
  positive: "text-[oklch(72%_0.18_155)]",
  negative: "text-[oklch(64%_0.22_25)]",
  accent:   "text-primary",
};

export function StatCard({ label, value, delta, tone = "default" }: StatCardProps) {
  return (
    <div className="interactive-card p-5 group">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] uppercase tracking-[0.2em] font-medium text-muted-foreground">
          {label}
        </p>
        {delta && (
          <span className="text-[10px] text-mono tabular-nums text-muted-foreground/80">
            {delta}
          </span>
        )}
      </div>
      <div className="hairline mb-3 opacity-60" />
      <p className={`stat-display text-4xl md:text-5xl font-semibold ${toneClass[tone]} transition-colors duration-300 group-hover:text-foreground`}>
        {value}
      </p>
    </div>
  );
}
