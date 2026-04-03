import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { StatusBadge } from "@/components/StatusBadge";
import { PlanPreview } from "@/components/PlanPreview";
import { OrchestrationFlowView } from "@/components/OrchestrationFlowView";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { Plus, ChevronDown, ChevronUp, Bot, Trash2, GitBranch } from "lucide-react";
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
import { format } from "date-fns";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";

interface OrchestrationResult {
  subtasks: Array<{
    task_id: string;
    title: string;
    owner: string | null;
    owner_name: string | null;
    type: string;
    priority?: string;
    delegatedTo?: string | null;
    assignments: Array<{ agent_id: string; role: string; fit_score?: number }>;
  }>;
  orchestration: {
    primaryAgents: string[];
    subAgentSpawns: Array<{
      parentName: string;
      subAgentName: string;
      reason: string;
      delegatedTasks: string[];
    }>;
    escalations: Array<{
      agentName: string;
      reason: string;
      action: string;
    }>;
    researchTriggers: Array<{
      agentName: string;
      topic: string;
    }>;
    totalTasks: number;
    delegationChains: Array<{
      task: string;
      from: string;
      to: string;
    }>;
  };
}

export default function PlansPage() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [orchestrationResult, setOrchestrationResult] = useState<OrchestrationResult | null>(null);
  const [orchestratingPlanTitle, setOrchestratingPlanTitle] = useState("");

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
      
      setOrchestratingPlanTitle(title);
      
      try {
        const { data: result } = await supabase.functions.invoke("decompose-plan", { body: { plan_id: data.id } });
        
        if (result?.orchestration) {
          setOrchestrationResult(result as OrchestrationResult);
          toast.success(`Plan decomposed: ${result.orchestration.totalTasks} tasks, ${result.orchestration.primaryAgents.length} agents`);
        } else if (result?.subtasks?.length > 0) {
          // Fallback for old response format
          setOrchestrationResult({
            subtasks: result.subtasks,
            orchestration: {
              primaryAgents: [...new Set(result.subtasks.map((s: any) => s.owner_name).filter(Boolean))] as string[],
              subAgentSpawns: [],
              escalations: [],
              researchTriggers: [],
              totalTasks: result.subtasks.length,
              delegationChains: [],
            },
          });
          toast.success(`Omega decomposed plan into ${result.subtasks.length} subtasks`);
        }

        // Dispatch agent-claim events
        for (const sub of (result?.subtasks || [])) {
          if (sub.owner) {
            window.dispatchEvent(new CustomEvent("agent-claim", {
              detail: { agentId: sub.owner, taskTitle: sub.title }
            }));
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
      queryClient.invalidateQueries({ queryKey: ["inbox-all"] });
      queryClient.invalidateQueries({ queryKey: ["inbox-unread"] });
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

  const clearAllPlans = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("plans").delete().gte("created_at", "1970-01-01");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      toast.success("All plans cleared");
    },
  });

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setShowPreview(true);
  };

  return (
    <Layout totalTokens={totalTokens} unreadCount={allInbox?.length || 0}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Plans</h2>
          <div className="flex items-center gap-2">
            {plans && plans.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="outline" className="text-destructive hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Clear All
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear all plans?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently remove all plans. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => clearAllPlans.mutate()}>
                      Clear All
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button size="sm" onClick={() => { setFormOpen(true); setOrchestrationResult(null); }}>
              <Plus className="h-4 w-4 mr-1" /> New Plan
            </Button>
          </div>
        </div>

        {/* Live Orchestration View */}
        {orchestrationResult && (
          <div className="rounded-lg border border-primary/20 bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">Live Orchestration</h3>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="text-xs h-6"
                onClick={() => setOrchestrationResult(null)}
              >
                Close
              </Button>
            </div>
            <OrchestrationFlowView
              planTitle={orchestratingPlanTitle}
              result={orchestrationResult}
            />
          </div>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
          </div>
        ) : plans && plans.length > 0 ? (
          <div className="space-y-2">
            {plans.map((plan) => (
              <div key={plan.id} className="rounded-lg border bg-card">
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-accent/20 transition-colors"
                  onClick={() => setExpandedId(expandedId === plan.id ? null : plan.id)}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{plan.title}</span>
                    <StatusBadge value={plan.status} />
                    {plan.status === "executing" && (
                      <span className="flex items-center gap-1 text-[10px] text-primary">
                        <Bot className="h-3 w-3 animate-pulse" /> Orchestrating
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{format(new Date(plan.created_at), "MMM d, yyyy")}</span>
                    {expandedId === plan.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </div>
                {expandedId === plan.id && (
                  <div className="border-t p-4 space-y-3 animate-fade-in">
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
        <SheetContent className="bg-card border-border sm:max-w-lg">
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
