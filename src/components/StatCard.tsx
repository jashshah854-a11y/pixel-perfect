interface StatCardProps {
  label: string;
  value: number | string;
}

export function StatCard({ label, value }: StatCardProps) {
  return (
    <div className="interactive-card p-4 space-y-1.5">
      <p className="text-xs text-muted-foreground font-medium tracking-wide">{label}</p>
      <p className="text-2xl font-semibold font-mono tabular-nums">{value}</p>
    </div>
  );
}
