import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { InboxMessage } from "@/components/InboxMessage";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Trash2, Inbox, Eye, Zap, CheckCircle, XCircle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const STATUS_FILTERS = [
  { value: "", label: "All", icon: Inbox },
  { value: "unread", label: "Unread", icon: Eye },
  { value: "acted", label: "Acted", icon: Zap },
  { value: "completed", label: "Completed", icon: CheckCircle },
  { value: "dismissed", label: "Dismissed", icon: XCircle },
] as const;

export default function InboxPage() {
  const queryClient = useQueryClient();
  const [filterType, setFilterType] = useState("");
  const [filterAgent, setFilterAgent] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

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

  const statusCounts: Record<string, number> = {};
  for (const m of messages || []) {
    statusCounts[m.status] = (statusCounts[m.status] || 0) + 1;
  }

  const markAllRead = useMutation({
    mutationFn: async () => {
      await supabase.from("inbox").update({ read: true, status: "opened" }).eq("read", false);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inbox-all"] });
      queryClient.invalidateQueries({ queryKey: ["inbox-unread"] });
    },
  });

  const clearAll = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("inbox").delete().gte("created_at", "1970-01-01");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inbox-all"] });
      queryClient.invalidateQueries({ queryKey: ["inbox-unread"] });
    },
  });

  const filtered = messages?.filter((m) => {
    if (filterType && m.type !== filterType) return false;
    if (filterAgent && m.from_agent !== filterAgent) return false;
    if (filterStatus && m.status !== filterStatus) return false;
    return true;
  });

  return (
    <Layout totalTokens={totalTokens} unreadCount={unreadCount}>
      <div className="space-y-5 p-1">
        <PageHeader
          eyebrow="Signal · Inbound"
          title="Inbox"
          description={unreadCount > 0 ? `${unreadCount} unread · ${messages?.length ?? 0} total` : `${messages?.length ?? 0} messages`}
          actions={
            <>
              {unreadCount > 0 && (
                <Button size="sm" variant="outline" onClick={() => markAllRead.mutate()}>
                  Mark all read
                </Button>
              )}
              {messages && messages.length > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="outline" className="text-destructive hover:text-destructive border-destructive/20 hover:border-destructive/40 hover:bg-destructive/5">
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Clear All
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Clear all messages?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently remove all inbox messages. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => clearAll.mutate()}>
                        Clear All
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </>
          }
        />

        {/* Status filter tabs */}
        <div className="flex items-center gap-1 p-1 rounded-lg surface-1 w-fit">
          {STATUS_FILTERS.map(({ value, label, icon: Icon }) => {
            const count = value ? (statusCounts[value] || 0) : (messages?.length || 0);
            const isActive = filterStatus === value;
            return (
              <button
                key={value}
                onClick={() => setFilterStatus(value)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all press-effect ${
                  isActive
                    ? "bg-gradient-accent text-primary-foreground shadow-glow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
                }`}
              >
                <Icon className="h-3 w-3" />
                {label}
                {count > 0 && (
                  <span className={`text-[9px] px-1 py-0.5 rounded-full min-w-[16px] text-center text-mono tabular-nums ${
                    isActive ? "bg-white/20" : "bg-white/[0.06]"
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Type and agent filters */}
        <div className="flex gap-2 flex-wrap">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="rounded-lg border border-white/[0.08] bg-white/[0.02] backdrop-blur-sm px-3 py-1.5 text-[12px] text-foreground hover:border-white/[0.14] focus:outline-none focus:ring-2 focus:ring-ring/60 transition-colors"
          >
            <option value="">All Types</option>
            <option value="critique">Critique</option>
            <option value="question">Question</option>
            <option value="update">Update</option>
            <option value="alert">Alert</option>
            <option value="recommendation">Recommendation</option>
            <option value="plan_decompose">Plan Decompose</option>
          </select>
          <select
            value={filterAgent}
            onChange={(e) => setFilterAgent(e.target.value)}
            className="rounded-lg border border-white/[0.08] bg-white/[0.02] backdrop-blur-sm px-3 py-1.5 text-[12px] text-foreground hover:border-white/[0.14] focus:outline-none focus:ring-2 focus:ring-ring/60 transition-colors"
          >
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
              />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <Inbox className="h-6 w-6 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-[12px] text-muted-foreground">
              {filterStatus ? `No ${filterStatus} messages.` : "No messages yet."}
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}
