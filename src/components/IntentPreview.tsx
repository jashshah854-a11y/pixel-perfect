import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Brain, Target, AlertCircle, CheckCircle2, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface IntentPreviewProps {
  taskId: string;
  agentMap: Record<string, string>;
}

const agentColors: Record<string, string> = {
  hivemind: "border-violet-500/30 bg-violet-500/5",
  omega: "border-cyan-500/30 bg-cyan-500/5",
  prism: "border-pink-500/30 bg-pink-500/5",
  oracle: "border-amber-500/30 bg-amber-500/5",
  sentinel: "border-red-500/30 bg-red-500/5",
  hawkeye: "border-emerald-500/30 bg-emerald-500/5",
  atlas: "border-sky-500/30 bg-sky-500/5",
};

export function IntentPreview({ taskId, agentMap }: IntentPreviewProps) {
  const { data: assignments } = useQuery({
    queryKey: ["task-assignments", taskId],
    queryFn: async () => {
      const { data } = await supabase
        .from("task_assignments")
        .select("*")
        .eq("task_id", taskId)
        .order("fit_score", { ascending: false });
      return data || [];
    },
  });

  const { data: memories } = useQuery({
    queryKey: ["task-memories-preview", taskId],
    queryFn: async () => {
      if (!assignments || assignments.length === 0) return [];
      const ownerAgentId = assignments.find(a => a.role === "owner")?.agent_id;
      if (!ownerAgentId) return [];
      const { data } = await supabase
        .from("agent_memory")
        .select("*")
        .eq("agent_id", ownerAgentId)
        .order("confidence", { ascending: false })
        .limit(5);
      return data || [];
    },
    enabled: !!assignments && assignments.length > 0,
  });

  if (!assignments || assignments.length === 0) return null;

  const owner = assignments.find(a => a.role === "owner");
  const supporters = assignments.filter(a => a.role === "support");

  if (!owner) return null;

  const ownerName = (agentMap[owner.agent_id] || owner.agent_id).toLowerCase();
  const colorClass = agentColors[ownerName] || "border-border/30 bg-card/50";
  const confidence = owner.fit_score;

  // Generate intent text from reasoning
  const intentText = owner.reasoning || "Task evaluation in progress";
  const expectedOutcome = confidence >= 70
    ? "High confidence — direct execution path"
    : confidence >= 40
    ? "Moderate confidence — may need collaboration"
    : "Low confidence — will seek guidance from peers";

  const risks = [];
  if (confidence < 40) risks.push("Low fit score — may require reassignment");
  if (supporters.length === 0 && confidence < 60) risks.push("No support agents — single point of execution");

  return (
    <div className={`rounded-lg border p-3 space-y-2 ${colorClass}`}>
      <div className="flex items-center gap-2">
        <Brain className="h-3.5 w-3.5 text-primary" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Intent Preview</span>
      </div>

      {/* Why this agent */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-xs">
          <Target className="h-3 w-3 text-primary shrink-0" />
          <span className="font-medium">{agentMap[owner.agent_id] || owner.agent_id}</span>
          <Badge variant="outline" className="text-[9px] px-1 py-0">
            {confidence}% match
          </Badge>
        </div>
        <p className="text-[11px] text-muted-foreground pl-5 leading-relaxed">{intentText}</p>
      </div>

      {/* Expected outcome */}
      <div className="flex items-start gap-2 text-[11px]">
        <CheckCircle2 className="h-3 w-3 text-emerald-400 mt-0.5 shrink-0" />
        <span className="text-muted-foreground">{expectedOutcome}</span>
      </div>

      {/* Confidence bar */}
      <div className="flex items-center gap-2 px-1">
        <TrendingUp className="h-3 w-3 text-muted-foreground" />
        <div className="flex-1 h-1.5 bg-muted/50 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              confidence >= 70 ? "bg-emerald-400" : confidence >= 40 ? "bg-amber-400" : "bg-red-400"
            }`}
            style={{ width: `${confidence}%` }}
          />
        </div>
        <span className="text-[9px] font-mono text-muted-foreground">{confidence}%</span>
      </div>

      {/* Memory influence */}
      {memories && memories.length > 0 && (
        <div className="text-[10px] text-muted-foreground/70 pl-5">
          <span className="font-medium">Memory influence:</span>{" "}
          {memories.slice(0, 2).map(m => m.content.slice(0, 40)).join(" • ")}
        </div>
      )}

      {/* Risks */}
      {risks.length > 0 && (
        <div className="space-y-1">
          {risks.map((r, i) => (
            <div key={i} className="flex items-center gap-1.5 text-[10px] text-amber-400/80">
              <AlertCircle className="h-2.5 w-2.5 shrink-0" />
              <span>{r}</span>
            </div>
          ))}
        </div>
      )}

      {/* Support agents */}
      {supporters.length > 0 && (
        <div className="text-[10px] text-muted-foreground/70 pl-5">
          Support: {supporters.map(s => agentMap[s.agent_id] || s.agent_id).join(", ")}
        </div>
      )}
    </div>
  );
}
