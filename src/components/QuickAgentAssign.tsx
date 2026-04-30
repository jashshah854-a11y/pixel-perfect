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
    <div className="surface-2 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <UserPlus className="h-3 w-3 text-primary" />
          <span className="text-[9.5px] uppercase tracking-[0.18em] font-medium text-muted-foreground">Quick Assign</span>
        </div>
      </div>

      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Task title…"
        className="text-[11.5px] h-8"
        onKeyDown={(e) => {
          if (e.key === "Enter" && title.trim()) assignTask.mutate();
        }}
      />

      <div className="flex gap-1.5">
        <Select value={selectedAgent} onValueChange={setSelectedAgent}>
          <SelectTrigger className="h-8 text-[11px] flex-1">
            <SelectValue placeholder="Auto-assign" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto" className="text-xs">Auto-assign (best fit)</SelectItem>
            {(agents || []).map(a => (
              <SelectItem key={a.id} value={a.id} className="text-xs">
                <span className="flex items-center gap-1.5">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor:
                      a.status === "working" ? "oklch(72% 0.18 155)" :
                      a.status === "idle"    ? "oklch(50% 0.005 250)" :
                                               "oklch(74% 0.18 65)" }}
                  />
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
          className="h-8 rounded-lg border border-white/[0.08] bg-white/[0.02] backdrop-blur-sm px-2 text-[11px] w-20 text-foreground hover:border-white/[0.14] focus:outline-none focus:ring-2 focus:ring-ring/60"
        >
          <option value="low">Low</option>
          <option value="medium">Med</option>
          <option value="high">High</option>
          <option value="critical">Crit</option>
        </select>
      </div>

      <Button
        size="sm"
        className="w-full h-8 text-[11px]"
        onClick={() => title.trim() && assignTask.mutate()}
        disabled={!title.trim() || assignTask.isPending}
      >
        <Send className="h-3 w-3 mr-1" />
        {assignTask.isPending ? "Assigning…" : selectedAgent && selectedAgent !== "auto" ? "Assign to Agent" : "Create & Auto-Assign"}
      </Button>
    </div>
  );
}
