import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { ExternalLink, Zap, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

export default function JobsPage() {
  const queryClient = useQueryClient();
  const [filterVerdict, setFilterVerdict] = useState("");
  const [minGhostScore, setMinGhostScore] = useState(0);
  const [sweepLoading, setSweepLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

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

  const { data: neonStats } = useQuery({
    queryKey: ["neon-stats"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.functions.invoke("sync-neon-stats");
        if (error) return null;
        return data;
      } catch {
        return null;
      }
    },
    retry: false,
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

  const triggerSweep = async () => {
    setSweepLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ghost-sweep-trigger");
      if (error) throw error;
      toast.success(`Sweep triggered! ${JSON.stringify(data)}`);
    } catch (err: any) {
      toast.error(`Sweep failed: ${err.message}`);
    } finally {
      setSweepLoading(false);
    }
  };

  const syncJobs = async () => {
    setSyncLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-neon-jobs");
      if (error) throw error;
      toast.success(`Synced ${data?.synced || 0} of ${data?.total || 0} jobs`);
      queryClient.invalidateQueries({ queryKey: ["sweep_results"] });
    } catch (err: any) {
      toast.error(`Sync failed: ${err.message}`);
    } finally {
      setSyncLoading(false);
    }
  };

  const logAndApply = async (job: any) => {
    try {
      await supabase.functions.invoke("log-application", {
        body: {
          company: job.company,
          job_title: job.job_title,
          apply_url: job.apply_url,
          fit_score: job.fit_score,
          verdict: job.verdict,
        },
      });
    } catch {
      // silent fail on logging
    }
    if (job.apply_url) {
      window.open(job.apply_url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <Layout totalTokens={totalTokens} unreadCount={allInbox?.length || 0}>
      <div className="space-y-5 p-1">
        <PageHeader
          eyebrow="Sentinel · Ghost Sweep"
          title="Job Pipeline"
          description="Live ATS scrapes, deduplication, and verdict assignment by Hawkeye."
          actions={
            <>
              <Button
                size="sm"
                onClick={triggerSweep}
                disabled={sweepLoading}
                className="gap-1.5"
              >
                <Zap className={`h-3.5 w-3.5 ${sweepLoading ? "animate-pulse" : ""}`} />
                {sweepLoading ? "Sweeping…" : "Trigger Sweep"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={syncJobs}
                disabled={syncLoading}
                className="gap-1.5"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${syncLoading ? "animate-spin" : ""}`} />
                {syncLoading ? "Syncing…" : "Sync Jobs"}
              </Button>
            </>
          }
        />

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
                        <button
                          onClick={() => logAndApply(s)}
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          Apply <ExternalLink className="h-3 w-3" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No sweep results yet"
            description="Run a Ghost Sweep to scan for stealth opportunities and ghost-job signals."
          />
        )}

        {/* Sweep History */}
        {neonStats?.recent_sweeps && neonStats.recent_sweeps.length > 0 && (
          <div className="rounded-lg border">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center justify-between w-full p-3 text-sm font-medium hover:bg-muted/20"
            >
              Sweep History ({neonStats.recent_sweeps.length} runs)
              {showHistory ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {showHistory && (
              <div className="border-t overflow-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left p-2 font-medium text-muted-foreground">Started</th>
                      <th className="text-left p-2 font-medium text-muted-foreground">Scraped</th>
                      <th className="text-left p-2 font-medium text-muted-foreground">Apply</th>
                      <th className="text-left p-2 font-medium text-muted-foreground">Maybe</th>
                      <th className="text-left p-2 font-medium text-muted-foreground">Skip</th>
                      <th className="text-left p-2 font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {neonStats.recent_sweeps.map((run: any) => (
                      <tr key={run.id} className="border-b">
                        <td className="p-2 font-mono">{run.started_at ? new Date(run.started_at).toLocaleString() : "—"}</td>
                        <td className="p-2 font-mono">{run.scraped_count ?? "—"}</td>
                        <td className="p-2 font-mono">{run.apply_count ?? "—"}</td>
                        <td className="p-2 font-mono">{run.maybe_count ?? "—"}</td>
                        <td className="p-2 font-mono">{run.skip_count ?? "—"}</td>
                        <td className="p-2"><StatusBadge value={run.status || "unknown"} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
