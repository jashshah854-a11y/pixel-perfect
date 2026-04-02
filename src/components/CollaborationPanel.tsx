import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, HelpCircle, Lightbulb, Eye, CheckCircle } from "lucide-react";

interface Collaboration {
  id: string;
  task_id: string | null;
  from_agent: string;
  to_agent: string;
  collab_type: string;
  message: string;
  status: string;
  created_at: string;
  resolved_at: string | null;
}

interface CollaborationPanelProps {
  agentMap: Record<string, string>;
}

const typeConfig: Record<string, { label: string; icon: typeof ArrowRight; color: string }> = {
  handoff: { label: "Handoff", icon: ArrowRight, color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  request_help: { label: "Help Request", icon: HelpCircle, color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  share_finding: { label: "Shared Finding", icon: Lightbulb, color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  review: { label: "Review", icon: Eye, color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
};

const statusIcons: Record<string, typeof CheckCircle> = {
  completed: CheckCircle,
};

export function CollaborationPanel({ agentMap }: CollaborationPanelProps) {
  const { data: collabs, refetch } = useQuery({
    queryKey: ["agent-collaborations"],
    queryFn: async () => {
      const { data } = await supabase
        .from("agent_collaborations")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      return (data || []) as Collaboration[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("collab-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "agent_collaborations" }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [refetch]);

  if (!collabs || collabs.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
        No agent collaborations yet. Agents will coordinate when tasks span multiple teams.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {collabs.map((c) => {
        const config = typeConfig[c.collab_type] || typeConfig.share_finding;
        const Icon = config.icon;
        const fromName = agentMap[c.from_agent] || c.from_agent;
        const toName = agentMap[c.to_agent] || c.to_agent;

        return (
          <div key={c.id} className="rounded-lg border bg-card p-3 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={config.color}>
                <Icon className="h-3 w-3 mr-1" />
                {config.label}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {fromName} → {toName}
              </span>
              {c.status === "completed" && (
                <CheckCircle className="h-3 w-3 text-emerald-400 ml-auto" />
              )}
              <span className="text-[10px] text-muted-foreground ml-auto">
                {new Date(c.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{c.message}</p>
          </div>
        );
      })}
    </div>
  );
}
