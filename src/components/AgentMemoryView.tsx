import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Brain, AlertTriangle, Heart, Sparkles } from "lucide-react";

interface Memory {
  id: string;
  agent_id: string;
  memory_type: string;
  content: string;
  confidence: number;
  tags: string[];
  created_at: string;
}

interface AgentMemoryViewProps {
  agentId: string;
  agentName: string;
}

const typeConfig: Record<string, { label: string; icon: typeof Brain; color: string }> = {
  pattern: { label: "Pattern", icon: Brain, color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  preference: { label: "Preference", icon: Heart, color: "bg-pink-500/20 text-pink-400 border-pink-500/30" },
  correction: { label: "Correction", icon: AlertTriangle, color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  insight: { label: "Insight", icon: Sparkles, color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
};

export function AgentMemoryView({ agentId, agentName }: AgentMemoryViewProps) {
  const { data: memories } = useQuery({
    queryKey: ["agent-memory", agentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("agent_memory")
        .select("*")
        .eq("agent_id", agentId)
        .order("created_at", { ascending: false })
        .limit(20);
      return (data || []) as Memory[];
    },
  });

  if (!memories || memories.length === 0) {
    return (
      <div className="text-xs text-muted-foreground text-center py-2">
        {agentName} hasn't learned anything yet.
      </div>
    );
  }

  // Group by type
  const grouped = memories.reduce<Record<string, Memory[]>>((acc, m) => {
    if (!acc[m.memory_type]) acc[m.memory_type] = [];
    acc[m.memory_type].push(m);
    return acc;
  }, {});

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Brain className="h-3 w-3" />
        <span>{memories.length} memories</span>
        <span className="text-[10px] font-mono">
          (avg confidence: {(memories.reduce((s, m) => s + m.confidence, 0) / memories.length * 100).toFixed(0)}%)
        </span>
      </div>

      {Object.entries(grouped).map(([type, items]) => {
        const config = typeConfig[type] || typeConfig.pattern;
        const Icon = config.icon;

        return (
          <div key={type} className="space-y-1">
            <Badge variant="outline" className={config.color}>
              <Icon className="h-3 w-3 mr-1" />
              {config.label} ({items.length})
            </Badge>
            {items.slice(0, 3).map((m) => (
              <div key={m.id} className="text-[11px] text-muted-foreground pl-2 border-l border-border/50">
                <p>{m.content}</p>
                <div className="flex gap-1 mt-0.5">
                  <span className="font-mono text-[9px] opacity-60">{(m.confidence * 100).toFixed(0)}%</span>
                  {m.tags?.slice(0, 2).map((t) => (
                    <span key={t} className="text-[9px] opacity-50">#{t}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
