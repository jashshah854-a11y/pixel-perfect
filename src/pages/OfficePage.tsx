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
        {/* ============= Command header ============= */}
        <header className="flex items-end justify-between px-2 pt-3 pb-3 shrink-0 gap-4">
          <div className="space-y-0.5 min-w-0">
            <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-muted-foreground/70">
              Live · Autonomous
            </p>
            <h1 className="text-display text-2xl md:text-3xl font-semibold leading-none">
              Command Center
            </h1>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Primary autonomous toggle */}
            <Button
              size="sm"
              onClick={() => togglePanel("autonomous")}
              className={`h-8 text-[11px] font-medium rounded-lg transition-all ${
                activePanel === "autonomous"
                  ? "bg-gradient-accent text-primary-foreground shadow-glow-sm"
                  : "bg-primary/15 text-primary hover:bg-primary/25 border border-primary/20"
              }`}
            >
              <Bot className="h-3.5 w-3.5 mr-1.5" />
              Autonomous
            </Button>

            {/* Secondary actions cluster */}
            <div className="flex items-center gap-0.5 ml-1 px-1 py-1 rounded-lg surface-1">
              {[
                { key: "health" as const,    icon: Activity,  label: "Health" },
                { key: "executive" as const, icon: Shield,    label: "Summary" },
                { key: "knowledge" as const, icon: Brain,     label: "Knowledge" },
                { key: "predict" as const,   icon: Lightbulb, label: "Predict" },
              ].map(({ key, icon: Icon, label }) => (
                <Button
                  key={key}
                  size="sm"
                  variant="ghost"
                  onClick={() => togglePanel(key)}
                  className={`h-6 text-[10.5px] px-2 rounded-md transition-colors ${
                    activePanel === key
                      ? "bg-white/10 text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
                  }`}
                >
                  <Icon className="h-3 w-3 mr-1" />
                  {label}
                </Button>
              ))}
            </div>

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
              className="h-8 text-[11px] ml-1 rounded-lg border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.06] hover:border-white/[0.12]"
            >
              <Zap className="h-3.5 w-3.5 mr-1.5" /> Dispatch Hivemind
            </Button>
          </div>
        </header>

        {/* Hairline separator */}
        <div className="hairline mx-2 mb-2 shrink-0" />

        {/* ============= Collapsible panel ============= */}
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

              {/* Agent detail popover — atmospheric, smart-positioned */}
              {selected && (() => {
                const POPOVER_W = 272;
                const POPOVER_H = 220;
                const PAD = 12;
                const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
                const vh = typeof window !== "undefined" ? window.innerHeight : 800;
                const left = Math.min(Math.max(PAD, selected.x - POPOVER_W / 2), vw - POPOVER_W - PAD);
                const top  = Math.min(Math.max(PAD, selected.y - POPOVER_H - 16), vh - POPOVER_H - PAD);
                const initial = agents?.find(a => a.id === selected.agent.id);
                const ag = initial ?? selected.agent;
                return (
                  <div
                    className="fixed z-50 surface-3 rounded-xl p-4 space-y-3 enter-scale"
                    style={{ left, top, width: POPOVER_W }}
                  >
                    <button
                      onClick={() => setSelected(null)}
                      className="absolute top-2 right-2.5 h-5 w-5 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors text-[11px]"
                      aria-label="Close"
                    >
                      ✕
                    </button>
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 rounded-full bg-gradient-accent grid place-items-center text-[13px] font-display font-bold text-primary-foreground shadow-glow-sm">
                        {ag.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium leading-tight truncate">{ag.name}</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{ag.role}</p>
                      </div>
                    </div>

                    <div className="hairline" />

                    <div className="space-y-1.5 text-[11.5px]">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Department</span>
                        <span className="text-foreground/90">{ag.department}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Status</span>
                        <span className="capitalize flex items-center gap-1.5">
                          <span
                            className="status-dot status-dot--active"
                            style={{ backgroundColor:
                              ag.status === "working" ? "hsl(var(--status-working))" :
                              ag.status === "blocked" ? "hsl(var(--status-blocked))" :
                              ag.status === "queued"  ? "hsl(var(--status-queued))"  :
                              "hsl(var(--status-idle))"
                            }}
                          />
                          {ag.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Tokens</span>
                        <span className="text-mono tabular-nums text-foreground/90">{ag.tokens_used.toLocaleString()}</span>
                      </div>
                      {ag.current_task && (
                        <div className="pt-2 mt-1 border-t border-white/[0.05]">
                          <span className="text-muted-foreground text-[10px] uppercase tracking-wider block mb-1">Current Task</span>
                          <p className="text-[11.5px] leading-snug text-foreground/85">{ag.current_task}</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
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
