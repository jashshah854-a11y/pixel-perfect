import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { AgentCard } from "@/components/AgentCard";
import { StatCard } from "@/components/StatCard";
import { InboxMessage } from "@/components/InboxMessage";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const navigate = useNavigate();

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

  const totalTokens = agents?.reduce((sum, a) => sum + a.tokens_used, 0) || 0;
  const unreadCount = allInbox?.length || 0;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const queued = tasks?.filter((t) => t.status === "queued").length || 0;
  const inProgress = tasks?.filter((t) => t.status === "in_progress").length || 0;
  const doneToday = tasks?.filter((t) => t.status === "done" && t.completed_at && new Date(t.completed_at) >= todayStart).length || 0;

  const agentMap = Object.fromEntries((agents || []).map((a) => [a.id, a.name]));

  return (
    <Layout totalTokens={totalTokens} unreadCount={unreadCount}>
      <div className="space-y-6">
        <h2 className="text-xl font-semibold">Dashboard</h2>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Queued" value={queued} />
          <StatCard label="In Progress" value={inProgress} />
          <StatCard label="Done Today" value={doneToday} />
          <StatCard label="Unread Inbox" value={unreadCount} />
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

        {/* Recent Inbox */}
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
      </div>
    </Layout>
  );
}
