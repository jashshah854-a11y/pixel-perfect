import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { OfficeCanvas } from "@/components/office-view/OfficeCanvas";
import { OfficeChat } from "@/components/OfficeChat";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useCallback, useState } from "react";
import { Zap } from "lucide-react";

interface SelectedAgent {
  agent: {
    id: string;
    name: string;
    status: string;
    role: string;
    department: string;
    current_task: string | null;
    tokens_used: number;
  };
  x: number;
  y: number;
}

export default function OfficePage() {
  const [selected, setSelected] = useState<SelectedAgent | null>(null);

  const { data: agents, isLoading } = useQuery({
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

  const handleAgentClick = useCallback(
    (agent: SelectedAgent["agent"], x: number, y: number) => {
      setSelected((prev) =>
        prev?.agent.id === agent.id ? null : { agent, x, y }
      );
    },
    []
  );

  return (
    <Layout totalTokens={totalTokens} unreadCount={allInbox?.length || 0}>
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Agent Office</h2>

        {isLoading ? (
          <Skeleton className="h-[420px] rounded-xl" />
        ) : agents ? (
          <div className="relative">
            <OfficeCanvas agents={agents} onAgentClick={handleAgentClick} />

            {/* Agent detail popover */}
            {selected && (
              <div
                className="fixed z-50 w-64 p-3 rounded-lg border bg-popover text-popover-foreground shadow-lg space-y-2"
                style={{ left: selected.x - 128, top: selected.y - 200 }}
              >
                <button
                  onClick={() => setSelected(null)}
                  className="absolute top-1 right-2 text-muted-foreground hover:text-foreground text-xs"
                >
                  ✕
                </button>
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-primary-foreground">
                    {selected.agent.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{selected.agent.name}</p>
                    <p className="text-[10px] text-muted-foreground">{selected.agent.role}</p>
                  </div>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Department</span>
                    <span>{selected.agent.department}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <span className="capitalize">{selected.agent.status}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tokens</span>
                    <span className="font-mono">{selected.agent.tokens_used.toLocaleString()}</span>
                  </div>
                  {selected.agent.current_task && (
                    <div>
                      <span className="text-muted-foreground block">Current Task</span>
                      <p className="mt-0.5">{selected.agent.current_task}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : null}

        {agents && <OfficeChat agents={agents} />}
      </div>
    </Layout>
  );
}
