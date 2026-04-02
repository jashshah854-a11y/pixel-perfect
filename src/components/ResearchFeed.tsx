import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Check, Clock } from "lucide-react";

interface ResearchEntry {
  id: string;
  agent_id: string;
  topic: string;
  findings: string | null;
  relevance_score: number;
  applied: boolean;
  researched_at: string;
}

interface ResearchFeedProps {
  agentMap: Record<string, string>;
}

export function ResearchFeed({ agentMap }: ResearchFeedProps) {
  const { data: research } = useQuery({
    queryKey: ["agent-research"],
    queryFn: async () => {
      const { data } = await supabase
        .from("agent_research_log")
        .select("*")
        .order("researched_at", { ascending: false })
        .limit(15);
      return (data || []) as ResearchEntry[];
    },
  });

  if (!research || research.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
        No autonomous research yet. Idle agents will study and improve over time.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {research.map((r) => {
        const agentName = agentMap[r.agent_id] || r.agent_id;
        const relevancePercent = (r.relevance_score * 100).toFixed(0);

        return (
          <div key={r.id} className="rounded-lg border bg-card p-3 space-y-1.5">
            <div className="flex items-center gap-2">
              <BookOpen className="h-3.5 w-3.5 text-primary" />
              <span className="text-sm font-medium">{agentName}</span>
              <span className="text-[10px] text-muted-foreground ml-auto">
                {new Date(r.researched_at).toLocaleDateString()}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">
                {r.topic}
              </Badge>
              <span className="text-[10px] font-mono text-muted-foreground">{relevancePercent}% relevant</span>
              {r.applied ? (
                <Check className="h-3 w-3 text-emerald-400 ml-auto" />
              ) : (
                <Clock className="h-3 w-3 text-muted-foreground ml-auto" />
              )}
            </div>
            {r.findings && (
              <p className="text-xs text-muted-foreground line-clamp-2">{r.findings}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
