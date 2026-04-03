import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { InboxMessage } from "@/components/InboxMessage";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useState } from "react";
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
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Inbox</h2>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button size="sm" variant="outline" onClick={() => markAllRead.mutate()}>
                Mark all read
              </Button>
            )}
            {messages && messages.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="outline" className="text-destructive hover:text-destructive">
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
          </div>
        </div>

        {/* Status filter tabs */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/30 border border-border/30 w-fit">
          {STATUS_FILTERS.map(({ value, label, icon: Icon }) => {
            const count = value ? (statusCounts[value] || 0) : (messages?.length || 0);
            const isActive = filterStatus === value;
            return (
              <button
                key={value}
                onClick={() => setFilterStatus(value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                }`}
              >
                <Icon className="h-3 w-3" />
                {label}
                {count > 0 && (
                  <span className={`text-[9px] px-1 py-0.5 rounded-full min-w-[16px] text-center ${
                    isActive ? "bg-primary-foreground/20" : "bg-muted/50"
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
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="rounded-md border bg-background px-2 py-1 text-sm">
            <option value="">All Types</option>
            <option value="critique">Critique</option>
            <option value="question">Question</option>
            <option value="update">Update</option>
            <option value="alert">Alert</option>
            <option value="recommendation">Recommendation</option>
            <option value="plan_decompose">Plan Decompose</option>
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
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {filterStatus ? `No ${filterStatus} messages.` : "No messages yet."}
          </p>
        )}
      </div>
    </Layout>
  );
}
