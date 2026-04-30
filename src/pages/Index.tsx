import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { AgentCard } from "@/components/AgentCard";
import { StatCard } from "@/components/StatCard";
import { InboxMessage } from "@/components/InboxMessage";
import { ResearchFeed } from "@/components/ResearchFeed";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { RefreshCw, Plug, BookOpen } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader, SectionLabel } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [loadingStats, setLoadingStats] = useState(false);

  const { data: agents, isLoading: loadingAgents } = useQuery({
    queryKey: ["agents"],
    queryFn: async () => {
      const { data } = await supabase.from("agents").select("*");
      return data || [];
    },
  });

  const { data: tasks } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data } = await supabase.from("tasks").select("*");
      return data || [];
    },
  });

  const { data: inbox } = useQuery({
    queryKey: ["inbox"],
    queryFn: async () => {
      const { data } = await supabase.from("inbox").select("*").order("created_at", { ascending: false }).limit(5);
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

  const { data: toolConnections } = useQuery({
    queryKey: ["tool_connections"],
    queryFn: async () => {
      const { data } = await supabase.from("tool_connections").select("*");
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
  const unreadCount = allInbox?.length || 0;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const queued = tasks?.filter((t) => t.status === "queued").length || 0;
  const inProgress = tasks?.filter((t) => t.status === "in_progress").length || 0;
  const doneToday = tasks?.filter((t) => t.status === "done" && t.completed_at && new Date(t.completed_at) >= todayStart).length || 0;

  const activeTools = toolConnections?.filter((t) => t.status === "active").length || 0;
  const availableTools = toolConnections?.filter((t) => t.status === "available").length || 0;
  const needsSetupTools = toolConnections?.filter((t) => t.status === "needs_setup").length || 0;

  const agentMap = Object.fromEntries((agents || []).map((a) => [a.id, a.name]));

  const refreshStats = async () => {
    setLoadingStats(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ["neon-stats"] });
      await queryClient.invalidateQueries({ queryKey: ["tool_connections"] });
      toast.success("Stats refreshed");
    } catch {
      toast.error("Failed to refresh stats");
    } finally {
      setLoadingStats(false);
    }
  };

  return (
    <Layout totalTokens={totalTokens} unreadCount={unreadCount}>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Command · Live"
          title="Dashboard"
          description="Real-time view of agents, pipeline, and signal flow."
          actions={
            <Button
              size="sm"
              variant="outline"
              onClick={refreshStats}
              disabled={loadingStats}
            >
              <RefreshCw className={`h-3 w-3 mr-1.5 ${loadingStats ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          }
        />

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Queued" value={queued} />
          <StatCard label="In Progress" value={inProgress} />
          <StatCard label="Done Today" value={doneToday} />
          <StatCard label="Unread Inbox" value={unreadCount} />
        </div>

        {/* Neon Stats */}
        {neonStats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Applications" value={neonStats.total_applications || 0} />
            <StatCard label="Jobs Queued" value={neonStats.jobs_queued || 0} />
            <StatCard label="Ghost Signals" value={neonStats.ghost_signals_scored || 0} />
            <StatCard label="Active Tools" value={activeTools} />
          </div>
        )}

        {/* Tool Status Mini-Row */}
        <div className="flex items-center gap-4 rounded-lg border bg-card p-3">
          <Plug className="h-4 w-4 text-muted-foreground" />
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-green-500" /> {activeTools} active
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-yellow-500" /> {availableTools} available
            </span>
            {needsSetupTools > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-red-500" /> {needsSetupTools} needs setup
              </span>
            )}
          </div>
          <button onClick={() => navigate("/integrations")} className="ml-auto text-xs text-primary hover:underline">
            View all
          </button>
        </div>

        {/* Agent Grid */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Agents</h3>
          {loadingAgents ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 7 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {agents?.map((agent) => (
                <AgentCard key={agent.id} agent={agent} compact />
              ))}
            </div>
          )}
        </div>

        {/* Recent Inbox + Research */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-muted-foreground">Recent Inbox</h3>
              <button onClick={() => navigate("/inbox")} className="text-xs text-primary hover:underline">View all</button>
            </div>
            {inbox && inbox.length > 0 ? (
              <div className="space-y-2">
                {inbox.map((msg) => (
                  <InboxMessage key={msg.id} message={msg} agentName={agentMap[msg.from_agent || ""] || undefined} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No messages yet.</p>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-medium text-muted-foreground">Agent Research</h3>
            </div>
            <ResearchFeed agentMap={agentMap} />
          </div>
        </div>
      </div>
    </Layout>
  );
}
