import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { OfficeCanvas } from "@/components/office-view/OfficeCanvas";
import { OfficeChat } from "@/components/OfficeChat";
import { QuickTaskPanel } from "@/components/QuickTaskPanel";
import { KnowledgeLog } from "@/components/KnowledgeLog";
import { OfficeOverview } from "@/components/OfficeOverview";
import { SystemHealthPanel } from "@/components/SystemHealthPanel";
import { ExecutiveSummary } from "@/components/ExecutiveSummary";
import { TaskPipelineView } from "@/components/TaskPipelineView";
import { QuickAgentAssign } from "@/components/QuickAgentAssign";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useCallback, useState } from "react";
import { Zap, Brain, Activity, Shield, Lightbulb, Bot } from "lucide-react";
import { PredictivePanel } from "@/components/PredictivePanel";
import { AutonomousControl } from "@/components/AutonomousControl";

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

type OverlayPanel = "none" | "health" | "executive" | "knowledge" | "predict" | "autonomous";

export default function OfficePage() {
  const [selected, setSelected] = useState<SelectedAgent | null>(null);
  const [activePanel, setActivePanel] = useState<OverlayPanel>("none");

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

  const togglePanel = (panel: OverlayPanel) => {
    setActivePanel(prev => prev === panel ? "none" : panel);
  };

  return (
    <Layout totalTokens={totalTokens} unreadCount={allInbox?.length || 0}>
      <div className="flex flex-col h-[calc(100vh-3.5rem)] md:h-screen overflow-hidden">
        {/* Header bar */}
        <div className="flex items-center justify-between px-1 py-2 shrink-0">
          <h2 className="text-base font-semibold tracking-tight">Command Center</h2>
          <div className="flex items-center gap-1">
            {/* Primary action */}
            <Button
              size="sm"
              variant={activePanel === "autonomous" ? "default" : "default"}
              onClick={() => togglePanel("autonomous")}
              className={`h-7 text-xs ${activePanel === "autonomous" ? "bg-primary" : "bg-primary/80 hover:bg-primary"}`}
            >
              <Bot className="h-3 w-3 mr-1" />
              Auto
            </Button>
            {/* Secondary actions */}
            <div className="flex items-center gap-0.5 ml-1 px-1 py-0.5 rounded-md bg-secondary/30">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => togglePanel("health")}
                className={`h-6 text-[11px] px-2 ${activePanel === "health" ? "bg-secondary text-foreground" : "text-muted-foreground"}`}
              >
                <Activity className="h-3 w-3 mr-1" />
                Health
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => togglePanel("executive")}
                className={`h-6 text-[11px] px-2 ${activePanel === "executive" ? "bg-secondary text-foreground" : "text-muted-foreground"}`}
              >
                <Shield className="h-3 w-3 mr-1" />
                Summary
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => togglePanel("knowledge")}
                className={`h-6 text-[11px] px-2 ${activePanel === "knowledge" ? "bg-secondary text-foreground" : "text-muted-foreground"}`}
              >
                <Brain className="h-3 w-3 mr-1" />
                Knowledge
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => togglePanel("predict")}
                className={`h-6 text-[11px] px-2 ${activePanel === "predict" ? "bg-secondary text-foreground" : "text-muted-foreground"}`}
              >
                <Lightbulb className="h-3 w-3 mr-1" />
                Predict
              </Button>
            </div>
            {/* Hivemind dispatch */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const depts = ["Architecture", "UI/UX", "Research", "Review", "DevOps"];
                const target = depts[Math.floor(Math.random() * depts.length)];
                const intensity = Math.ceil(Math.random() * 4) + 1;
                window.dispatchEvent(new CustomEvent("hivemind-dispatch", {
                  detail: { targetRoom: target, taskTitle: `Support ${target} team`, intensity }
                }));
              }}
              className="h-7 text-xs ml-1"
            >
              <Zap className="h-3 w-3 mr-1" /> Hivemind
            </Button>
          </div>
        </div>

        {/* Collapsible Panel */}
        {activePanel !== "none" && agents && (
          <div className="panel enter-fade shrink-0 max-h-[30vh] overflow-y-auto mx-1 mb-2">
            {activePanel === "health" && <SystemHealthPanel />}
            {activePanel === "executive" && <ExecutiveSummary />}
            {activePanel === "knowledge" && <KnowledgeLog agents={agents} />}
            {activePanel === "predict" && <PredictivePanel />}
            {activePanel === "autonomous" && <AutonomousControl />}
          </div>
        )}

        {/* Main canvas + chat in a flex layout that fills remaining space */}
        <div className="flex-1 min-h-0 flex flex-col gap-2 px-1">
          {isLoading ? (
            <Skeleton className="flex-1 rounded-xl" />
          ) : agents ? (
            <div className="relative flex-1 min-h-0">
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

          {/* Bottom panel: Pipeline + Overview + Chat + Assign */}
          {agents && (
            <div className="shrink-0 space-y-2">
              <TaskPipelineView />
              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2">
                <OfficeOverview />
                <div className="md:w-56">
                  <QuickAgentAssign />
                </div>
                <div className="md:w-72">
                  <OfficeChat agents={agents} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <QuickTaskPanel />
    </Layout>
  );
}
