import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { UserPlus, Send } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function QuickAgentAssign() {
  const [title, setTitle] = useState("");
  const [selectedAgent, setSelectedAgent] = useState("");
  const [priority, setPriority] = useState("medium");
  const queryClient = useQueryClient();

  const { data: agents } = useQuery({
    queryKey: ["assign-agents"],
    queryFn: async () => {
      const { data } = await supabase.from("agents").select("id, name, status, department");
      return data || [];
    },
  });

  const assignTask = useMutation({
    mutationFn: async () => {
      // Create task assigned to specific agent
      const { data, error } = await supabase
        .from("tasks")
        .insert({
          title,
          priority,
          status: selectedAgent ? "in_progress" : "queued",
          source: "direct-assign",
          assigned_to: selectedAgent || null,
        })
        .select("id")
        .single();
      if (error) throw error;

      if (selectedAgent) {
        // Update agent status
        await supabase.from("agents").update({ status: "working", current_task: title }).eq("id", selectedAgent);

        // Create assignment record
        await supabase.from("task_assignments").insert({
          task_id: data.id,
          agent_id: selectedAgent,
          role: "owner",
          fit_score: 100,
          reasoning: "Direct assignment by CEO",
        });

        const agentName = agents?.find(a => a.id === selectedAgent)?.name || selectedAgent;

        // Dispatch visual claim event
        window.dispatchEvent(
          new CustomEvent("agent-claim", {
            detail: { agentId: selectedAgent, taskTitle: title },
          })
        );

        toast.success(`Task assigned to ${agentName}`);
      } else {
        // Auto-assign via edge function
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
            toast.success(`Task auto-assigned to ${result.owner_name || result.owner}`);
          }
        } catch {
          toast.info("Task created. Assignment pending.");
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      setTitle("");
      setSelectedAgent("");
    },
  });

  return (
    <div className="rounded-lg border border-border/20 bg-card/40 p-3 space-y-2">
      <div className="flex items-center gap-1.5">
        <UserPlus className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-medium">Quick Assign</span>
      </div>

      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Task title..."
        className="text-xs h-7"
        onKeyDown={(e) => {
          if (e.key === "Enter" && title.trim()) assignTask.mutate();
        }}
      />

      <div className="flex gap-1.5">
        <Select value={selectedAgent} onValueChange={setSelectedAgent}>
          <SelectTrigger className="h-7 text-[11px] flex-1">
            <SelectValue placeholder="Auto-assign" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto" className="text-xs">Auto-assign (best fit)</SelectItem>
            {(agents || []).map(a => (
              <SelectItem key={a.id} value={a.id} className="text-xs">
                <span className="flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full ${a.status === "working" ? "bg-emerald-400" : a.status === "idle" ? "bg-muted-foreground" : "bg-amber-400"}`} />
                  {a.name}
                  <span className="text-muted-foreground">({a.department})</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="h-7 rounded-md border bg-background px-1.5 text-[11px] w-20"
        >
          <option value="low">Low</option>
          <option value="medium">Med</option>
          <option value="high">High</option>
          <option value="critical">Crit</option>
        </select>
      </div>

      <Button
        size="sm"
        className="w-full h-7 text-xs"
        onClick={() => title.trim() && assignTask.mutate()}
        disabled={!title.trim() || assignTask.isPending}
      >
        <Send className="h-3 w-3 mr-1" />
        {assignTask.isPending ? "Assigning..." : selectedAgent && selectedAgent !== "auto" ? "Assign to Agent" : "Create & Auto-Assign"}
      </Button>
    </div>
  );
}
