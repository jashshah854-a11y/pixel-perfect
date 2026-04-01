import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { AgentDesk } from "@/components/AgentDesk";
import { OfficeChat } from "@/components/OfficeChat";
import { Skeleton } from "@/components/ui/skeleton";

export default function OfficePage() {
  const { data: agents, isLoading } = useQuery({
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

  return (
    <Layout totalTokens={totalTokens} unreadCount={allInbox?.length || 0}>
      <div className="space-y-6">
        <h2 className="text-xl font-semibold">Agent Office</h2>

        {/* Office floor */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {agents?.map((agent) => (
              <AgentDesk key={agent.id} agent={agent} />
            ))}
          </div>
        )}

        {/* Chat room */}
        {agents && <OfficeChat agents={agents} />}
      </div>
    </Layout>
  );
}
