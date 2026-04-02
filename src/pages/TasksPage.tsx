import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { TaskCard } from "@/components/TaskCard";
import { TaskForm } from "@/components/TaskForm";
import { AssignmentFeed } from "@/components/AssignmentFeed";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Zap } from "lucide-react";
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
        await supabase.functions.invoke("assign-task", { body: { task_id: data.id } });
        toast.success("Task created & auto-assigned to best-fit agent");
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
