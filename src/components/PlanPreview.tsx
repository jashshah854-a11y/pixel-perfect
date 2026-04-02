import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Brain, GitBranch, Play, X, User, ArrowRight, Loader2, AlertTriangle, Clock, Zap, BarChart3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const DEPT_KEYWORDS: Record<string, string[]> = {
  orchestration: ["coordinate", "plan", "manage", "organize", "workflow", "pipeline"],
  architecture: ["design", "system", "infrastructure", "scale", "architecture", "database", "schema"],
  "ui/ux": ["ui", "ux", "component", "page", "layout", "style", "responsive", "interface", "visual", "css", "react"],
  research: ["data", "analysis", "research", "insight", "report", "metric", "ai", "ml"],
  review: ["test", "quality", "bug", "verify", "validate", "debug", "fix", "security"],
  devops: ["api", "server", "endpoint", "deploy", "edge", "webhook", "backend", "function"],
};

const agentBadgeColors: Record<string, string> = {
  hivemind: "bg-violet-500/20 text-violet-400 border-violet-500/30",
  omega: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  prism: "bg-pink-500/20 text-pink-400 border-pink-500/30",
  oracle: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  sentinel: "bg-red-500/20 text-red-400 border-red-500/30",
  hawkeye: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  atlas: "bg-sky-500/20 text-sky-400 border-sky-500/30",
};

interface SubtaskPreview {
  title: string;
  suggestedAgent: string;
  confidence: number;
  dependencies: string[];
}

interface OutcomeScenario {
  label: string;
  completionHours: number;
  riskScore: number;
  hivemindNeeded: boolean;
  color: string;
}

interface PlanPreviewProps {
  title: string;
  content: string;
  agents: Array<{ id: string; name: string; department: string; status: string }>;
  onConfirm: () => void;
  onCancel: () => void;
  isSubmitting: boolean;
}

function generatePreview(title: string, content: string, agents: Array<{ name: string; department: string; status: string }>): SubtaskPreview[] {
  const subtasks: SubtaskPreview[] = [];
  const lines = content.split("\n").filter(l => l.trim().length > 5);
  const taskLines = lines.filter(l => /^[-*•]/.test(l.trim()) || /^\d+[\.\)]/.test(l.trim()));
  const items = taskLines.length > 0
    ? taskLines.map(l => l.replace(/^[-*•\d\.\)]+\s*/, "").trim())
    : [title];

  for (const item of items.slice(0, 8)) {
    const itemText = item.toLowerCase();
    let bestAgent = "omega";
    let bestScore = 0;

    for (const agent of agents) {
      const dept = agent.department.toLowerCase();
      const keywords = DEPT_KEYWORDS[dept] || [];
      const matched = keywords.filter(kw => itemText.includes(kw));
      let score = matched.length * 15;
      if (agent.status === "idle") score += 10;
      if (score > bestScore) {
        bestScore = score;
        bestAgent = agent.name.toLowerCase();
      }
    }

    subtasks.push({
      title: item.length > 60 ? item.slice(0, 57) + "..." : item,
      suggestedAgent: bestAgent,
      confidence: Math.min(bestScore + 20, 95),
      dependencies: [],
    });
  }

  if (subtasks.length > 1) {
    subtasks.unshift({
      title: `Coordinate: ${title}`,
      suggestedAgent: "omega",
      confidence: 90,
      dependencies: [],
    });
  }

  return subtasks;
}

function simulateOutcomes(
  subtasks: SubtaskPreview[],
  agents: Array<{ id: string; name: string; status: string }>,
  activeTasks: number,
  blockedTasks: number
): OutcomeScenario[] {
  const agentWorkloads: Record<string, number> = {};
  for (const s of subtasks) {
    agentWorkloads[s.suggestedAgent] = (agentWorkloads[s.suggestedAgent] || 0) + 1;
  }

  const maxWorkload = Math.max(...Object.values(agentWorkloads), 1);
  const overloadedCount = Object.values(agentWorkloads).filter(v => v > 2).length;
  const busyAgents = agents.filter(a => a.status === "working").length;

  const baseHours = subtasks.length * 1.5;
  const congestionFactor = 1 + (activeTasks * 0.1) + (busyAgents * 0.15);
  const blockRisk = blockedTasks * 0.1;

  return [
    {
      label: "Best Case",
      completionHours: Math.round(baseHours * 0.7),
      riskScore: Math.round(Math.max(5, blockRisk * 50)),
      hivemindNeeded: false,
      color: "text-emerald-400",
    },
    {
      label: "Expected",
      completionHours: Math.round(baseHours * congestionFactor),
      riskScore: Math.round(Math.min(80, (blockRisk + overloadedCount * 0.15) * 100)),
      hivemindNeeded: overloadedCount > 0,
      color: "text-blue-400",
    },
    {
      label: "Worst Case",
      completionHours: Math.round(baseHours * congestionFactor * 1.8),
      riskScore: Math.round(Math.min(95, (blockRisk + overloadedCount * 0.25 + 0.2) * 100)),
      hivemindNeeded: true,
      color: "text-red-400",
    },
  ];
}

export function PlanPreview({ title, content, agents, onConfirm, onCancel, isSubmitting }: PlanPreviewProps) {
  const subtasks = generatePreview(title, content, agents);
  const involvedAgents = [...new Set(subtasks.map(s => s.suggestedAgent))];

  // Fetch real system state for simulation
  const { data: tasks } = useQuery({
    queryKey: ["tasks-for-sim"],
    queryFn: async () => {
      const { data } = await supabase.from("tasks").select("status");
      return data || [];
    },
  });

  const activeTasks = tasks?.filter(t => t.status === "in_progress").length || 0;
  const blockedTasks = tasks?.filter(t => t.status === "blocked").length || 0;

  const scenarios = simulateOutcomes(subtasks, agents, activeTasks, blockedTasks);

  // Workload distribution
  const workloadDist: Record<string, number> = {};
  for (const s of subtasks) {
    workloadDist[s.suggestedAgent] = (workloadDist[s.suggestedAgent] || 0) + 1;
  }
  const maxWork = Math.max(...Object.values(workloadDist), 1);

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Execution Preview</h3>
        </div>
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Agents involved */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] text-muted-foreground">Agents:</span>
        {involvedAgents.map(a => (
          <Badge key={a} variant="outline" className={`text-[10px] px-1.5 py-0 ${agentBadgeColors[a] || ""}`}>
            <User className="h-2.5 w-2.5 mr-0.5" />
            {a.charAt(0).toUpperCase() + a.slice(1)}
          </Badge>
        ))}
      </div>

      {/* Outcome Simulation */}
      <div className="space-y-1.5">
        <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
          <BarChart3 className="h-3 w-3" /> Outcome Simulation
        </p>
        <div className="grid grid-cols-3 gap-2">
          {scenarios.map(s => (
            <div key={s.label} className="rounded-md border border-border/20 bg-muted/20 p-2 text-center">
              <p className={`text-[10px] font-medium ${s.color}`}>{s.label}</p>
              <p className="text-sm font-bold font-mono mt-0.5">{s.completionHours}h</p>
              <div className="flex items-center justify-center gap-1 mt-1">
                <AlertTriangle className={`h-2.5 w-2.5 ${s.riskScore > 50 ? "text-red-400" : s.riskScore > 25 ? "text-amber-400" : "text-emerald-400"}`} />
                <span className="text-[9px] text-muted-foreground">Risk {s.riskScore}%</span>
              </div>
              {s.hivemindNeeded && (
                <span className="text-[8px] text-violet-400 flex items-center justify-center gap-0.5 mt-0.5">
                  <Zap className="h-2 w-2" /> Hivemind
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Workload Distribution */}
      <div className="space-y-1">
        <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" /> Workload Distribution
        </p>
        {Object.entries(workloadDist).map(([agent, count]) => (
          <div key={agent} className="flex items-center gap-2 text-[11px]">
            <span className="w-16 truncate text-right text-muted-foreground">{agent}</span>
            <div className="flex-1 h-2 bg-muted/30 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${count > 2 ? "bg-amber-400" : "bg-primary"}`}
                style={{ width: `${(count / maxWork) * 100}%` }}
              />
            </div>
            <span className="text-[9px] font-mono text-muted-foreground w-4 text-right">{count}</span>
          </div>
        ))}
      </div>

      {/* Task breakdown */}
      <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
        {subtasks.map((sub, i) => (
          <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/30 border border-border/20">
            <span className="text-[10px] font-mono text-muted-foreground/50 w-4">{i + 1}</span>
            <ArrowRight className="h-2.5 w-2.5 text-muted-foreground/30 shrink-0" />
            <span className="text-xs flex-1 truncate">{sub.title}</span>
            <Badge variant="outline" className={`text-[9px] px-1 py-0 shrink-0 ${agentBadgeColors[sub.suggestedAgent] || ""}`}>
              {sub.suggestedAgent.slice(0, 3).toUpperCase()}
            </Badge>
            <span className={`text-[9px] font-mono shrink-0 ${
              sub.confidence >= 70 ? "text-emerald-400" : sub.confidence >= 40 ? "text-amber-400" : "text-red-400"
            }`}>
              {sub.confidence}%
            </span>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{subtasks.length} tasks • {involvedAgents.length} agents</span>
        <span>Orchestrated by Omega</span>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onCancel} className="flex-1" disabled={isSubmitting}>
          Cancel
        </Button>
        <Button size="sm" onClick={onConfirm} className="flex-1" disabled={isSubmitting}>
          {isSubmitting ? (
            <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Executing...</>
          ) : (
            <><Play className="h-3.5 w-3.5 mr-1" /> Execute Plan</>
          )}
        </Button>
      </div>
    </div>
  );
}
