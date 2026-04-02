import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { StatusBadge } from "@/components/StatusBadge";
import { PlanPreview } from "@/components/PlanPreview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { Plus, ChevronDown, ChevronUp, Bot } from "lucide-react";
import { format } from "date-fns";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";

export default function PlansPage() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  const { data: plans, isLoading } = useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const { data } = await supabase.from("plans").select("*").order("created_at", { ascending: false });
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

  const createPlan = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from("plans").insert({ title, markdown_content: content }).select("id").single();
      if (error) throw error;
      try {
        const { data: result } = await supabase.functions.invoke("decompose-plan", { body: { plan_id: data.id } });
        if (result?.subtasks?.length > 0) {
          toast.success(`Omega decomposed plan into ${result.subtasks.length} subtasks`);
          for (const sub of result.subtasks) {
            if (sub.owner) {
              window.dispatchEvent(new CustomEvent("agent-claim", {
                detail: { agentId: sub.owner, taskTitle: sub.title }
              }));
            }
          }
        }
      } catch {
        toast.info("Plan created. Omega orchestration pending.");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task-assignments"] });
      setTitle("");
      setContent("");
      setFormOpen(false);
      setShowPreview(false);
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await supabase.from("plans").update({ status }).eq("id", id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["plans"] }),
  });

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    // Show preview instead of immediate submission
    setShowPreview(true);
  };

  return (
    <Layout totalTokens={totalTokens} unreadCount={allInbox?.length || 0}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Plans</h2>
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> New Plan
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
          </div>
        ) : plans && plans.length > 0 ? (
          <div className="space-y-2">
            {plans.map((plan) => (
              <div key={plan.id} className="rounded-lg border bg-card">
                <div
                  className="flex items-center justify-between p-4 cursor-pointer"
                  onClick={() => setExpandedId(expandedId === plan.id ? null : plan.id)}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{plan.title}</span>
                    <StatusBadge value={plan.status} />
                    {plan.status === "executing" && (
                      <span className="flex items-center gap-1 text-[10px] text-primary">
                        <Bot className="h-3 w-3" /> Sent to Omega
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{format(new Date(plan.created_at), "MMM d, yyyy")}</span>
                    {expandedId === plan.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </div>
                {expandedId === plan.id && (
                  <div className="border-t p-4 space-y-3">
                    <select
                      value={plan.status}
                      onChange={(e) => updateStatus.mutate({ id: plan.id, status: e.target.value })}
                      className="rounded-md border bg-background px-2 py-1 text-sm"
                    >
                      <option value="draft">Draft</option>
                      <option value="approved">Approved</option>
                      <option value="executing">Executing</option>
                      <option value="done">Done</option>
                    </select>
                    <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap text-sm text-muted-foreground">
                      {plan.markdown_content || "No content."}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No plans yet.</p>
        )}
      </div>

      <Sheet open={formOpen} onOpenChange={(open) => { setFormOpen(open); if (!open) setShowPreview(false); }}>
        <SheetContent className="bg-card border-border">
          <SheetHeader>
            <SheetTitle>New Plan</SheetTitle>
          </SheetHeader>

          {!showPreview ? (
            <form onSubmit={handleFormSubmit} className="mt-4 space-y-4">
              <div>
                <label className="text-sm text-muted-foreground">Title</label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Plan title" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Content (Markdown)</label>
                <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Write your plan..." className="min-h-[200px]" />
              </div>
              <Button type="submit" className="w-full" disabled={!title.trim()}>
                Preview Execution
              </Button>
            </form>
          ) : (
            <div className="mt-4">
              <PlanPreview
                title={title}
                content={content}
                agents={agents || []}
                onConfirm={() => createPlan.mutate()}
                onCancel={() => setShowPreview(false)}
                isSubmitting={createPlan.isPending}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </Layout>
  );
}
