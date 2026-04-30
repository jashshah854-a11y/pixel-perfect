import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText, CheckCircle, Clock, Download, ChevronDown, ChevronUp,
  Code, FileSearch, BarChart3, Play, Eye, Package, Bot, Zap,
  RefreshCw,
} from "lucide-react";
import { format } from "date-fns";
import { useState, useMemo } from "react";
import { toast } from "sonner";

const OUTPUT_TYPE_CONFIG: Record<string, { icon: typeof Code; color: string; label: string }> = {
  code: { icon: Code, color: "text-blue-400", label: "Code" },
  report: { icon: FileText, color: "text-emerald-400", label: "Report" },
  research: { icon: FileSearch, color: "text-amber-400", label: "Research" },
  analysis: { icon: BarChart3, color: "text-violet-400", label: "Analysis" },
  component: { icon: Package, color: "text-pink-400", label: "Component" },
  prototype: { icon: Play, color: "text-cyan-400", label: "Prototype" },
};

const FORMAT_LABELS: Record<string, string> = {
  tsx: "React/TSX",
  ts: "TypeScript",
  js: "JavaScript",
  markdown: "Markdown",
  md: "Markdown",
  json: "JSON",
  sql: "SQL",
  css: "CSS",
  html: "HTML",
};

export default function DeliverablesPage() {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("");

  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ["deliverable-tasks"],
    queryFn: async () => {
      const { data } = await supabase.from("tasks").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: outputs, isLoading: outputsLoading } = useQuery({
    queryKey: ["deliverable-outputs"],
    queryFn: async () => {
      const { data } = await supabase.from("task_outputs").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: agents } = useQuery({
    queryKey: ["agents"],
    queryFn: async () => {
      const { data } = await supabase.from("agents").select("*");
      return data || [];
    },
  });

  const { data: assignments } = useQuery({
    queryKey: ["deliverable-assignments"],
    queryFn: async () => {
      const { data } = await supabase.from("task_assignments").select("task_id, agent_id, role").eq("role", "owner");
      return data || [];
    },
  });

  useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const { data } = await supabase.from("plans").select("id, title");
      return data || [];
    },
  });

  const { data: inbox } = useQuery({
    queryKey: ["inbox-unread"],
    queryFn: async () => {
      const { data } = await supabase.from("inbox").select("id").eq("read", false);
      return data || [];
    },
  });

  const totalTokens = agents?.reduce((s, a) => s + a.tokens_used, 0) || 0;
  const agentMap = Object.fromEntries((agents || []).map(a => [a.id, a.name]));
  const ownerMap = Object.fromEntries((assignments || []).map(a => [a.task_id, a.agent_id]));

  // Group outputs by task
  const outputsByTask = useMemo(() => {
    const map: Record<string, typeof outputs> = {};
    for (const o of outputs || []) {
      if (!map[o.task_id]) map[o.task_id] = [];
      map[o.task_id]!.push(o);
    }
    return map;
  }, [outputs]);

  // Tasks with outputs (real deliverables)
  const deliverablesData = useMemo(() => {
    const taskList = (tasks || []).filter(t => {
      const taskOutputs = outputsByTask[t.id];
      return taskOutputs && taskOutputs.length > 0;
    });

    if (filterType) {
      return taskList.filter(t => {
        const taskOutputs = outputsByTask[t.id] || [];
        return taskOutputs.some(o => o.output_type === filterType);
      });
    }

    return taskList;
  }, [tasks, outputsByTask, filterType]);

  // Stats
  const totalOutputs = (outputs || []).length;
  const codeOutputs = (outputs || []).filter(o => o.output_type === "code").length;
  const reportOutputs = (outputs || []).filter(o => o.output_type === "report").length;
  const totalLines = (outputs || []).reduce((s, o) => s + (o.content?.split('\n').length || 0), 0);

  const triggerTick = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("autonomous-tick");
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["deliverable-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["deliverable-outputs"] });
      queryClient.invalidateQueries({ queryKey: ["deliverable-assignments"] });
      toast.success(`Tick complete: ${data?.actions_taken || 0} actions`);
    },
    onError: () => toast.error("Tick failed"),
  });

  const downloadOutput = (output: { title: string; content: string; format: string }) => {
    const ext = output.format === "markdown" ? "md" : output.format || "txt";
    const blob = new Blob([output.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${output.title.replace(/\s+/g, "_").toLowerCase()}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadAll = () => {
    for (const o of outputs || []) {
      downloadOutput(o);
    }
    toast.success(`Downloaded ${outputs?.length || 0} files`);
  };

  const isLoading = tasksLoading || outputsLoading;

  return (
    <Layout totalTokens={totalTokens} unreadCount={inbox?.length || 0}>
      <div className="space-y-5 max-w-5xl mx-auto p-1">
        <PageHeader
          eyebrow="Output · Verifiable"
          title="Deliverables"
          description={`${totalOutputs} artifacts produced · ${totalLines.toLocaleString()} lines of generated work`}
          actions={
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => triggerTick.mutate()}
                disabled={triggerTick.isPending}
                className="gap-1.5"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${triggerTick.isPending ? 'animate-spin' : ''}`} />
                Run Tick
              </Button>
              {totalOutputs > 0 && (
                <Button size="sm" variant="outline" onClick={downloadAll} className="gap-1.5">
                  <Download className="h-3.5 w-3.5" /> Export All
                </Button>
              )}
            </>
          }
        />

        {/* Stats — editorial display */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total Outputs",  value: totalOutputs,                 icon: Package,   tone: "primary" },
            { label: "Code Artifacts", value: codeOutputs,                  icon: Code,      tone: "primary" },
            { label: "Reports",        value: reportOutputs,                icon: FileText,  tone: "positive" },
            { label: "Total Lines",    value: totalLines.toLocaleString(),  icon: BarChart3, tone: "primary" },
          ].map(s => {
            const toneStyle =
              s.tone === "positive" ? { color: "oklch(72% 0.18 155)" } :
                                       { color: "hsl(var(--primary))" };
            return (
              <div key={s.label} className="surface-2 rounded-xl p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <s.icon className="h-3 w-3" style={toneStyle} />
                  <span className="text-[9.5px] uppercase tracking-[0.18em] font-medium text-muted-foreground">{s.label}</span>
                </div>
                <div className="hairline mb-2 opacity-50" />
                <p className="stat-display text-2xl font-semibold leading-none">{s.value}</p>
              </div>
            );
          })}
        </div>

        {/* Filter */}
        <div className="flex items-center gap-1 p-1 rounded-lg surface-1 w-fit">
          {["", "code", "report"].map(type => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1 rounded-md text-[11px] font-medium transition-all press-effect ${
                filterType === type
                  ? "bg-gradient-accent text-primary-foreground shadow-glow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
              }`}
            >
              {type || "All"} {type && `(${type === "code" ? codeOutputs : reportOutputs})`}
            </button>
          ))}
        </div>

        {/* Deliverables list */}
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
          </div>
        ) : deliverablesData.length > 0 ? (
          <div className="space-y-2">
            {deliverablesData.map(task => {
              const taskOutputs = outputsByTask[task.id] || [];
              const isExpanded = expandedId === task.id;
              const ownerId = ownerMap[task.id];
              const ownerName = ownerId ? agentMap[ownerId] : null;
              const isDone = task.status === "done";

              return (
                <div key={task.id} className={`rounded-lg border transition-all ${
                  isDone ? "border-emerald-500/20 bg-card/80" : "border-border/30 bg-card/60"
                }`}>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : task.id)}
                    className="w-full flex items-center justify-between p-3.5 text-left hover:bg-accent/20 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {isDone ? (
                        <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                      ) : (
                        <Clock className="h-4 w-4 text-amber-400 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{task.title}</span>
                          <Badge variant="outline" className="text-[9px] px-1.5">
                            {taskOutputs.length} output{taskOutputs.length > 1 ? "s" : ""}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {ownerName && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Bot className="h-2.5 w-2.5" /> {ownerName}
                            </span>
                          )}
                          <span className="text-[10px] text-muted-foreground">
                            {task.source === "plan" ? "From plan" : task.source}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex items-center gap-1">
                        {taskOutputs.map(o => {
                          const config = OUTPUT_TYPE_CONFIG[o.output_type] || OUTPUT_TYPE_CONFIG.code;
                          const Icon = config.icon;
                          return <Icon key={o.id} className={`h-3 w-3 ${config.color}`} />;
                        })}
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {format(new Date(task.created_at), "MMM d, HH:mm")}
                      </span>
                      {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-border/20 p-4 space-y-3 animate-fade-in">
                      {task.description && (
                        <p className="text-xs text-muted-foreground leading-relaxed">{task.description}</p>
                      )}

                      {taskOutputs.map(output => {
                        const config = OUTPUT_TYPE_CONFIG[output.output_type] || OUTPUT_TYPE_CONFIG.code;
                        const Icon = config.icon;
                        const isPreviewing = previewId === output.id;
                        const isCode = output.output_type === "code";
                        const lines = output.content?.split('\n').length || 0;

                        return (
                          <div key={output.id} className="rounded-lg border border-border/20 bg-background/40 overflow-hidden">
                            {/* Output header */}
                            <div className="flex items-center justify-between p-3 border-b border-border/10">
                              <div className="flex items-center gap-2">
                                <Icon className={`h-3.5 w-3.5 ${config.color}`} />
                                <span className="text-xs font-medium">{output.title}</span>
                                <Badge variant="outline" className="text-[9px]">
                                  {FORMAT_LABELS[output.format] || output.format}
                                </Badge>
                                <span className="text-[9px] text-muted-foreground">
                                  {lines} lines · {(output.content?.length || 0).toLocaleString()} chars
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0"
                                  onClick={() => setPreviewId(isPreviewing ? null : output.id)}
                                >
                                  <Eye className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0"
                                  onClick={() => downloadOutput(output)}
                                >
                                  <Download className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>

                            {/* Preview / Content */}
                            {isPreviewing && (
                              <div className={`p-3 max-h-96 overflow-y-auto ${isCode ? 'bg-[#0d1117]' : ''}`}>
                                {isCode ? (
                                  <pre className="text-xs font-mono text-emerald-300 whitespace-pre-wrap leading-relaxed">
                                    <code>{output.content}</code>
                                  </pre>
                                ) : (
                                  <div className="text-xs text-foreground whitespace-pre-wrap leading-relaxed prose prose-invert prose-sm max-w-none">
                                    {output.content}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Collapsed preview */}
                            {!isPreviewing && (
                              <div className="px-3 py-2">
                                <p className="text-[10px] text-muted-foreground truncate font-mono">
                                  {output.content?.slice(0, 120)}...
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Metadata */}
                      <div className="flex items-center gap-3 pt-2 border-t border-border/10 text-[9px] text-muted-foreground">
                        <span>Task ID: {task.id.slice(0, 8)}</span>
                        <span>Priority: {task.priority}</span>
                        <span>Source: {task.source}</span>
                        {task.completed_at && <span>Completed: {format(new Date(task.completed_at), "MMM d, HH:mm")}</span>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="No deliverables yet"
            description="Create a plan or task, then run the autonomous tick to generate verifiable outputs."
            icon={<Package className="h-5 w-5" />}
            action={
              <Button size="sm" variant="outline" onClick={() => triggerTick.mutate()} disabled={triggerTick.isPending}>
                <Zap className="h-3.5 w-3.5 mr-1" /> Run Autonomous Tick
              </Button>
            }
          />
        )}
      </div>
    </Layout>
  );
}
