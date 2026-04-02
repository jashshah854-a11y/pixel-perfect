import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { User, Users, Eye, Zap } from "lucide-react";

interface Assignment {
  id: string;
  task_id: string;
  agent_id: string;
  role: string;
  fit_score: number;
  reasoning: string | null;
  claimed_at: string;
}

interface AssignmentFeedProps {
  agentMap: Record<string, string>;
  taskMap: Record<string, string>;
}

const roleConfig: Record<string, { label: string; color: string; icon: typeof User }> = {
  owner: { label: "Owner", color: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: Zap },
  support: { label: "Support", color: "bg-amber-500/20 text-amber-400 border-amber-500/30", icon: Users },
  observer: { label: "Observer", color: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30", icon: Eye },
};

export function AssignmentFeed({ agentMap, taskMap }: AssignmentFeedProps) {
  const { data: assignments, refetch } = useQuery({
    queryKey: ["task-assignments"],
    queryFn: async () => {
      const { data } = await supabase
        .from("task_assignments")
        .select("*")
        .order("claimed_at", { ascending: false })
        .limit(50);
      return (data || []) as Assignment[];
    },
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("assignment-feed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "task_assignments" }, () => {
        refetch();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [refetch]);

  // Group by task
  const grouped = (assignments || []).reduce<Record<string, Assignment[]>>((acc, a) => {
    if (!acc[a.task_id]) acc[a.task_id] = [];
    acc[a.task_id].push(a);
    return acc;
  }, {});

  const taskIds = Object.keys(grouped);

  if (taskIds.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        No assignments yet. Create a task and watch agents claim it automatically.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {taskIds.slice(0, 10).map((taskId) => {
        const items = grouped[taskId].sort((a, b) => b.fit_score - a.fit_score);
        const owner = items.find(i => i.role === "owner");
        const supporters = items.filter(i => i.role === "support");
        const taskTitle = taskMap[taskId] || "Unknown Task";
        const timestamp = items[0]?.claimed_at;

        return (
          <div key={taskId} className="rounded-lg border bg-card p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium">{taskTitle}</p>
              {timestamp && (
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                  {new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </div>

            {/* Owner */}
            {owner && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={roleConfig.owner.color}>
                  <Zap className="h-3 w-3 mr-1" />
                  Owner
                </Badge>
                <span className="text-sm">{agentMap[owner.agent_id] || owner.agent_id}</span>
                <span className="text-xs text-muted-foreground font-mono">({owner.fit_score}%)</span>
              </div>
            )}

            {/* Support */}
            {supporters.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={roleConfig.support.color}>
                  <Users className="h-3 w-3 mr-1" />
                  Support
                </Badge>
                {supporters.map(s => (
                  <span key={s.id} className="text-xs text-muted-foreground">
                    {agentMap[s.agent_id] || s.agent_id} ({s.fit_score}%)
                  </span>
                ))}
              </div>
            )}

            {/* Reasoning from owner */}
            {owner?.reasoning && (
              <p className="text-xs text-muted-foreground italic">{owner.reasoning}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
