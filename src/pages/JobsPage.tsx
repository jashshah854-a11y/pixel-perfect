import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { ExternalLink } from "lucide-react";

export default function JobsPage() {
  const [filterVerdict, setFilterVerdict] = useState("");
  const [minGhostScore, setMinGhostScore] = useState(0);

  const { data: sweeps, isLoading } = useQuery({
    queryKey: ["sweep_results"],
    queryFn: async () => {
      const { data } = await supabase.from("sweep_results").select("*").order("ghost_score", { ascending: false });
      return data || [];
    },
  });

  const { data: agents } = useQuery({
    queryKey: ["agents"],
    queryFn: async () => {
      const { data } = await supabase.from("agents").select("*");
      return data || [];
    },
  });

  const { data: allInbox } = useQuery({
    queryKey: ["inbox-unread"],
    queryFn: async () => {
      const { data } = await supabase.from("inbox").select("id").eq("read", false);
      return data || [];
    },
  });

  const totalTokens = agents?.reduce((sum, a) => sum + a.tokens_used, 0) || 0;

  const filtered = sweeps?.filter((s) => {
    if (filterVerdict && s.verdict !== filterVerdict) return false;
    if (s.ghost_score < minGhostScore) return false;
    return true;
  });

  const ghostColor = (score: number) => {
    if (score >= 70) return "text-green-400";
    if (score >= 40) return "text-yellow-400";
    return "text-red-400";
  };

  return (
    <Layout totalTokens={totalTokens} unreadCount={allInbox?.length || 0}>
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Ghost Sweep Jobs</h2>

        <div className="flex gap-2 flex-wrap">
          <select value={filterVerdict} onChange={(e) => setFilterVerdict(e.target.value)} className="rounded-md border bg-background px-2 py-1 text-sm">
            <option value="">All Verdicts</option>
            <option value="apply">Apply</option>
            <option value="maybe">Maybe</option>
            <option value="skip">Skip</option>
          </select>
          <div className="flex items-center gap-1">
            <label className="text-xs text-muted-foreground">Min Ghost:</label>
            <input
              type="number"
              min={0}
              max={100}
              value={minGhostScore}
              onChange={(e) => setMinGhostScore(Number(e.target.value))}
              className="w-16 rounded-md border bg-background px-2 py-1 text-sm font-mono"
            />
          </div>
        </div>

        {isLoading ? (
          <Skeleton className="h-48 rounded-lg" />
        ) : filtered && filtered.length > 0 ? (
          <div className="overflow-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left p-3 font-medium text-muted-foreground">Company</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Title</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Ghost</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Fit</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Verdict</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className={`border-b hover:bg-muted/20 ${s.fit_score >= 6 ? "bg-primary/5" : ""}`}>
                    <td className="p-3">{s.company}</td>
                    <td className="p-3">{s.job_title}</td>
                    <td className={`p-3 font-mono font-semibold ${ghostColor(s.ghost_score)}`}>{s.ghost_score}</td>
                    <td className="p-3 font-mono">{s.fit_score}</td>
                    <td className="p-3"><StatusBadge value={s.verdict} /></td>
                    <td className="p-3">
                      {s.apply_url && (
                        <a href={s.apply_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                          Apply <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No sweep results yet.</p>
        )}
      </div>
    </Layout>
  );
}
