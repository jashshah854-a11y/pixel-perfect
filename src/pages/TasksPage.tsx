import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { TaskCard } from "@/components/TaskCard";
import { TaskForm } from "@/components/TaskForm";
import { AssignmentFeed } from "@/components/AssignmentFeed";
import { IntentPreview } from "@/components/IntentPreview";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Zap, Brain, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { playClaimChime, playDropConfirm } from "@/lib/sounds";

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
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [expandedIntentId, setExpandedIntentId] = useState<string | null>(null);

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

  const updateTaskStatus = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: string }) => {
      const update: Record<string, unknown> = { status };
      if (status === "done") update.completed_at = new Date().toISOString();
      await supabase.from("tasks").update(update).eq("id", taskId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const createTask = useMutation({
    mutationFn: async (task: { title: string; description: string; priority: string; assigned_to: string | null; source: string }) => {
      const { data, error } = await supabase.from("tasks").insert(task).select("id").single();
      if (error) throw error;
      try {
        const { data: result } = await supabase.functions.invoke("assign-task", { body: { task_id: data.id } });
        toast.success("Task created & auto-assigned to best-fit agent");
        playClaimChime();
        if (result?.owner) {
          window.dispatchEvent(new CustomEvent("agent-claim", {
            detail: { agentId: result.owner, taskTitle: task.title }
          }));
        }
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

  const handleDragStart = useCallback((taskId: string) => {
    setDragTaskId(taskId);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, columnKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTarget(columnKey);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDropTarget(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, columnKey: string) => {
    e.preventDefault();
    setDropTarget(null);
    if (dragTaskId) {
      const task = tasks?.find(t => t.id === dragTaskId);
      if (task && task.status !== columnKey) {
        updateTaskStatus.mutate({ taskId: dragTaskId, status: columnKey });
        playDropConfirm();
        toast.success(`Task moved to ${columns.find(c => c.key === columnKey)?.label}`);
      }
    }
    setDragTaskId(null);
  }, [dragTaskId, tasks, updateTaskStatus]);

  const handleDragEnd = useCallback(() => {
    setDragTaskId(null);
    setDropTarget(null);
  }, []);

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
              const isOver = dropTarget === col.key;
              return (
                <div
                  key={col.key}
                  className={`space-y-2 rounded-lg p-2 transition-all duration-200 ${
                    isOver
                      ? "bg-primary/10 ring-2 ring-primary/40 ring-inset"
                      : dragTaskId
                        ? "bg-muted/30 ring-1 ring-border/50 ring-inset"
                        : ""
                  }`}
                  onDragOver={(e) => handleDragOver(e, col.key)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, col.key)}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-sm font-medium text-muted-foreground">{col.label}</h3>
                    <span className="text-xs font-mono text-muted-foreground">{colTasks.length}</span>
                  </div>
                  {colTasks.length === 0 ? (
                    <p className={`text-xs text-muted-foreground p-3 border border-dashed rounded-lg text-center transition-colors ${
                      isOver ? "border-primary/40 text-primary" : ""
                    }`}>
                      {isOver ? "Drop here" : "No tasks"}
                    </p>
                  ) : (
                    colTasks.map((task) => (
                      <div key={task.id}>
                        <div
                          draggable
                          onDragStart={() => handleDragStart(task.id)}
                          onDragEnd={handleDragEnd}
                          className={`cursor-grab active:cursor-grabbing transition-all duration-150 ${
                            dragTaskId === task.id ? "opacity-40 scale-95" : ""
                          }`}
                        >
                          <TaskCard task={task} agentName={agentMap[task.assigned_to || ""] || undefined} />
                          {/* Intent toggle */}
                          {task.assigned_to && task.status === "in_progress" && (
                            <button
                              onClick={() => setExpandedIntentId(expandedIntentId === task.id ? null : task.id)}
                              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors mt-1 ml-1"
                            >
                              <Brain className="h-2.5 w-2.5" />
                              Intent
                              {expandedIntentId === task.id ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
                            </button>
                          )}
                        </div>
                        {/* Intent Preview */}
                        {expandedIntentId === task.id && (
                          <div className="mt-1.5 animate-fade-in">
                            <IntentPreview taskId={task.id} agentMap={agentMap} />
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Assignment Feed */}
        <div className="mt-6">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-medium">Assignment Log</h3>
          </div>
          <AssignmentFeed agentMap={agentMap} taskMap={taskMap} />
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
