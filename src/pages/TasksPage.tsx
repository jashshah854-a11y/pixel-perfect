import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { TaskCard } from "@/components/TaskCard";
import { TaskForm } from "@/components/TaskForm";
import { AssignmentFeed } from "@/components/AssignmentFeed";
import { CollaborationPanel } from "@/components/CollaborationPanel";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Zap, Users, Brain } from "lucide-react";
import { toast } from "sonner";

const columns = [
  { key: "queued", label: "Queued" },
  { key: "in_progress", label: "In Progress" },
  { key: "done", label: "Done" },
  { key: "blocked", label: "Blocked" },
];

export default function TasksPage() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [filterAgent, setFilterAgent] = useState("");
  const [filterPriority, setFilterPriority] = useState("");

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data } = await supabase.from("tasks").select("*").order("created_at", { ascending: false });
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
  const agentMap = Object.fromEntries((agents || []).map((a) => [a.id, a.name]));

  const createTask = useMutation({
    mutationFn: async (task: { title: string; description: string; priority: string; assigned_to: string | null; source: string }) => {
      const { data, error } = await supabase.from("tasks").insert(task).select("id").single();
      if (error) throw error;
      // Auto-assign via edge function
      try {
        const { data: result } = await supabase.functions.invoke("assign-task", { body: { task_id: data.id } });
        toast.success("Task created & auto-assigned to best-fit agent");
        // Dispatch office claim animation
        if (result?.owner) {
          window.dispatchEvent(new CustomEvent("agent-claim", {
            detail: { agentId: result.owner, taskTitle: task.title }
          }));
        }

        // Dispatch Hivemind swarm if Hivemind is involved
        if (result?.assignments) {
          const hivemindEntry = result.assignments.find(
            (a: { agent_id: string; role: string }) => {
              const agent = agents?.find(ag => ag.id === a.agent_id);
              return agent?.name.toLowerCase() === "hivemind" && (a.role === "support" || a.role === "owner");
            }
          );
          if (hivemindEntry) {
            const ownerAgent = result.assignments.find((a: { role: string }) => a.role === "owner");
            const targetDept = agents?.find(ag => ag.id === ownerAgent?.agent_id)?.department || "Architecture";
            const intensity = Math.ceil((hivemindEntry.fit_score || 50) / 25);
            window.dispatchEvent(new CustomEvent("hivemind-dispatch", {
              detail: { targetRoom: targetDept, taskTitle: task.title, intensity }
            }));
          }
        }
      } catch {
        toast.info("Task created. Auto-assignment pending.");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    },
  });

  const taskMap = Object.fromEntries((tasks || []).map((t) => [t.id, t.title]));

  const filtered = tasks?.filter((t) => {
    if (filterAgent && t.assigned_to !== filterAgent) return false;
    if (filterPriority && t.priority !== filterPriority) return false;
    return true;
  });

  return (
    <Layout totalTokens={totalTokens} unreadCount={allInbox?.length || 0}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Tasks</h2>
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> New Task
          </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          <select value={filterAgent} onChange={(e) => setFilterAgent(e.target.value)} className="rounded-md border bg-background px-2 py-1 text-sm">
            <option value="">All Agents</option>
            {agents?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} className="rounded-md border bg-background px-2 py-1 text-sm">
            <option value="">All Priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {columns.map((col) => (
              <Skeleton key={col.key} className="h-48 rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {columns.map((col) => {
              const colTasks = filtered?.filter((t) => t.status === col.key) || [];
              return (
                <div key={col.key} className="space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-sm font-medium text-muted-foreground">{col.label}</h3>
                    <span className="text-xs font-mono text-muted-foreground">{colTasks.length}</span>
                  </div>
                  {colTasks.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-3 border border-dashed rounded-lg text-center">No tasks</p>
                  ) : (
                    colTasks.map((task) => (
                      <TaskCard key={task.id} task={task} agentName={agentMap[task.assigned_to || ""] || undefined} />
                    ))
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Intelligence Panels */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Zap className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-medium">Assignment Log</h3>
            </div>
            <AssignmentFeed agentMap={agentMap} taskMap={taskMap} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-medium">Agent Collaboration</h3>
            </div>
            <CollaborationPanel agentMap={agentMap} />
          </div>
        </div>
      </div>

      <TaskForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        agents={agents || []}
        onSubmit={(task) => createTask.mutate(task)}
      />
    </Layout>
  );
}
