import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { InboxMessage } from "@/components/InboxMessage";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export default function InboxPage() {
  const queryClient = useQueryClient();
  const [filterType, setFilterType] = useState("");
  const [filterAgent, setFilterAgent] = useState("");

  const { data: messages, isLoading } = useQuery({
    queryKey: ["inbox-all"],
    queryFn: async () => {
      const { data } = await supabase.from("inbox").select("*").order("created_at", { ascending: false });
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

  const totalTokens = agents?.reduce((sum, a) => sum + a.tokens_used, 0) || 0;
  const unreadCount = messages?.filter((m) => !m.read).length || 0;
  const agentMap = Object.fromEntries((agents || []).map((a) => [a.id, a.name]));

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("inbox").update({ read: true }).eq("id", id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inbox-all"] });
      queryClient.invalidateQueries({ queryKey: ["inbox-unread"] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      await supabase.from("inbox").update({ read: true }).eq("read", false);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inbox-all"] });
      queryClient.invalidateQueries({ queryKey: ["inbox-unread"] });
    },
  });

  const filtered = messages?.filter((m) => {
    if (filterType && m.type !== filterType) return false;
    if (filterAgent && m.from_agent !== filterAgent) return false;
    return true;
  });

  return (
    <Layout totalTokens={totalTokens} unreadCount={unreadCount}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Inbox</h2>
          {unreadCount > 0 && (
            <Button size="sm" variant="outline" onClick={() => markAllRead.mutate()}>
              Mark all read
            </Button>
          )}
        </div>

        <div className="flex gap-2 flex-wrap">
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="rounded-md border bg-background px-2 py-1 text-sm">
            <option value="">All Types</option>
            <option value="critique">Critique</option>
            <option value="question">Question</option>
            <option value="update">Update</option>
            <option value="alert">Alert</option>
          </select>
          <select value={filterAgent} onChange={(e) => setFilterAgent(e.target.value)} className="rounded-md border bg-background px-2 py-1 text-sm">
            <option value="">All Agents</option>
            {agents?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
          </div>
        ) : filtered && filtered.length > 0 ? (
          <div className="space-y-2">
            {filtered.map((msg) => (
              <InboxMessage
                key={msg.id}
                message={msg}
                agentName={agentMap[msg.from_agent || ""] || undefined}
                onClick={() => !msg.read && markRead.mutate(msg.id)}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No messages yet.</p>
        )}
      </div>
    </Layout>
  );
}
