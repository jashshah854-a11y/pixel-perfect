import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Zap, ChevronRight, ChevronLeft } from "lucide-react";
import { toast } from "sonner";

export function QuickTaskPanel() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("medium");
  const queryClient = useQueryClient();

  const createTask = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .insert({ title, priority, status: "queued", source: "ceo-office" })
        .select("id")
        .single();
      if (error) throw error;

      // Auto-assign
      try {
        const { data: result } = await supabase.functions.invoke("assign-task", {
          body: { task_id: data.id },
        });
        if (result?.owner) {
          window.dispatchEvent(
            new CustomEvent("agent-claim", {
              detail: { agentId: result.owner, taskTitle: title },
            })
          );
          toast.success(`Task assigned to ${result.owner_name || result.owner}`);
        }
      } catch {
        toast.info("Task created. Assignment pending.");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task-assignments"] });
      setTitle("");
    },
  });

  return (
    <div className="fixed right-0 top-1/2 -translate-y-1/2 z-40 flex items-center">
      {/* Toggle tab */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-center w-6 h-16 rounded-l-md bg-card/90 backdrop-blur-sm border border-r-0 border-border/40 text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
      </button>

      {/* Panel */}
      <div
        className={`bg-card/95 backdrop-blur-sm border border-border/40 rounded-l-lg shadow-xl transition-all duration-300 overflow-hidden ${
          open ? "w-64 p-4" : "w-0 p-0"
        }`}
      >
        {open && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Zap className="h-3.5 w-3.5 text-primary" />
              Quick Assign
            </div>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title..."
              className="text-sm h-8"
              onKeyDown={(e) => {
                if (e.key === "Enter" && title.trim()) createTask.mutate();
              }}
            />
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full rounded-md border bg-background px-2 py-1 text-sm"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
            <Button
              size="sm"
              className="w-full"
              onClick={() => title.trim() && createTask.mutate()}
              disabled={!title.trim() || createTask.isPending}
            >
              {createTask.isPending ? "Assigning..." : "Create & Assign"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
