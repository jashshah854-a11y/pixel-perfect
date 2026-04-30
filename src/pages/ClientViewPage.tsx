import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/PageHeader";
import { FileText, CheckCircle, Clock, Download, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";

export default function ClientViewPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: tasks } = useQuery({
    queryKey: ["client-tasks"],
    queryFn: async () => {
      const { data } = await supabase.from("tasks").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: outputs } = useQuery({
    queryKey: ["client-outputs"],
    queryFn: async () => {
      const { data } = await supabase.from("task_outputs").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: agents } = useQuery({
    queryKey: ["client-agents"],
    queryFn: async () => {
      const { data } = await supabase.from("agents").select("id, name, tokens_used");
      return data || [];
    },
  });

  const { data: inbox } = useQuery({
    queryKey: ["client-inbox-unread"],
    queryFn: async () => {
      const { data } = await supabase.from("inbox").select("id").eq("read", false);
      return data || [];
    },
  });

  const totalTokens = agents?.reduce((s, a) => s + a.tokens_used, 0) || 0;
  const allTasks = tasks || [];
  const doneTasks = allTasks.filter(t => t.status === "done");
  const inProgressTasks = allTasks.filter(t => t.status === "in_progress");
  const queuedTasks = allTasks.filter(t => t.status === "queued");
  const outputMap: Record<string, typeof outputs> = {};
  for (const o of outputs || []) {
    if (!outputMap[o.task_id]) outputMap[o.task_id] = [];
    outputMap[o.task_id]!.push(o);
  }

  const downloadOutput = (output: { title: string; content: string }) => {
    const blob = new Blob(
      [`# ${output.title}\n\n${output.content}\n\n---\nExported: ${new Date().toISOString()}`],
      { type: "text/markdown" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${output.title.replace(/\s+/g, "_").toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Layout totalTokens={totalTokens} unreadCount={inbox?.length || 0}>
      <div className="space-y-6 max-w-4xl mx-auto p-1">
        <PageHeader
          eyebrow="Client View · Public"
          title="Deliverables"
          description="Clean output view — completed work and progress, no internal complexity."
        />

        {/* Progress summary */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Queued",      count: queuedTasks.length,     icon: Clock,         tone: "muted" },
            { label: "In Progress", count: inProgressTasks.length, icon: Clock,         tone: "warn" },
            { label: "Completed",   count: doneTasks.length,       icon: CheckCircle,   tone: "positive" },
          ].map(s => {
            const toneStyle =
              s.tone === "positive" ? { color: "oklch(72% 0.18 155)" } :
              s.tone === "warn"     ? { color: "oklch(74% 0.18 65)" } :
                                      { color: "oklch(60% 0 0)" };
            return (
              <div key={s.label} className="surface-2 rounded-xl p-4 flex items-center gap-3">
                <s.icon className="h-4 w-4" style={toneStyle} />
                <div>
                  <p className="stat-display text-2xl font-semibold leading-none" style={toneStyle}>{s.count}</p>
                  <p className="text-[9.5px] uppercase tracking-[0.18em] text-muted-foreground mt-1">{s.label}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Completed work with outputs */}
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-[0.22em] font-medium text-muted-foreground/80 px-1">Completed Work & Deliverables</p>
          {doneTasks.length === 0 && (
            <div className="empty-state">
              <p className="text-[12px] text-muted-foreground">No completed work yet.</p>
            </div>
          )}
          {doneTasks.map(task => {
            const taskOutputs = outputMap[task.id] || [];
            const isExpanded = expandedId === task.id;
            return (
              <div key={task.id} className="rounded-lg border border-border/30 bg-card/60">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : task.id)}
                  className="w-full flex items-center justify-between p-3 text-left"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    <span className="text-sm font-medium truncate">{task.title}</span>
                    {taskOutputs.length > 0 && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">{taskOutputs.length} output{taskOutputs.length > 1 ? "s" : ""}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-muted-foreground">
                      {task.completed_at ? format(new Date(task.completed_at), "MMM d, HH:mm") : ""}
                    </span>
                    {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-border/20 p-3 space-y-2">
                    {task.description && (
                      <p className="text-xs text-muted-foreground">{task.description}</p>
                    )}
                    {taskOutputs.length > 0 ? (
                      taskOutputs.map(o => (
                        <div key={o.id} className="rounded-md border border-border/20 bg-background/40 p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <FileText className="h-3 w-3 text-primary" />
                              <span className="text-xs font-medium">{o.title}</span>
                              <span className="text-[9px] px-1 py-0.5 rounded bg-muted/30 text-muted-foreground capitalize">{o.output_type}</span>
                            </div>
                            <button onClick={() => downloadOutput(o)} className="text-muted-foreground hover:text-primary transition-colors">
                              <Download className="h-3 w-3" />
                            </button>
                          </div>
                          <div className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                            {o.content}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-[10px] text-muted-foreground">No deliverables attached.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* In-progress visibility */}
        {inProgressTasks.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">Currently In Progress</h3>
            {inProgressTasks.map(task => (
              <div key={task.id} className="rounded-lg border border-border/30 bg-card/60 p-3 flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-sm">{task.title}</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-400/10 text-amber-400 capitalize ml-auto">{task.priority}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
