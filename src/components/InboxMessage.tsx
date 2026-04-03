import { useState } from "react";
import { StatusBadge } from "./StatusBadge";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  ThumbsUp,
  ThumbsDown,
  Zap,
  ExternalLink,
  Eye,
  Sparkles,
  AlertTriangle,
  ArrowRight,
  Clock,
} from "lucide-react";

interface InboxMessageProps {
  message: {
    id: string;
    from_agent: string | null;
    to_agent: string | null;
    message: string;
    type: string;
    read: boolean;
    status: string;
    metadata: Record<string, any> | null;
    feedback: string | null;
    created_at: string;
  };
  agentName?: string;
  agents?: Array<{ id: string; name: string; department: string; role: string }>;
}

const STATUS_ICONS: Record<string, typeof CheckCircle> = {
  unread: Eye,
  opened: Clock,
  acted: Zap,
  completed: CheckCircle,
  dismissed: XCircle,
};

const TYPE_CONFIG: Record<string, { icon: typeof Sparkles; color: string; label: string }> = {
  critique: { icon: AlertTriangle, color: "text-amber-400", label: "Critique" },
  question: { icon: Sparkles, color: "text-blue-400", label: "Question" },
  update: { icon: Zap, color: "text-primary", label: "Update" },
  alert: { icon: AlertTriangle, color: "text-destructive", label: "Alert" },
  recommendation: { icon: Sparkles, color: "text-emerald-400", label: "Recommendation" },
  suggestion: { icon: Sparkles, color: "text-violet-400", label: "Suggestion" },
};

function parseInboxContent(message: string, metadata: Record<string, any> | null) {
  const sections: {
    overview: string;
    reasoning: string;
    impact: string;
    nextSteps: string[];
    actions: Array<{ label: string; type: string; payload?: Record<string, any> }>;
    links: Array<{ label: string; url: string }>;
  } = {
    overview: message,
    reasoning: "",
    impact: "",
    nextSteps: [],
    actions: [],
    links: [],
  };

  if (metadata) {
    if (metadata.reasoning) sections.reasoning = metadata.reasoning;
    if (metadata.impact) sections.impact = metadata.impact;
    if (metadata.next_steps) sections.nextSteps = metadata.next_steps;
    if (metadata.actions) sections.actions = metadata.actions;
    if (metadata.links) sections.links = metadata.links;
  }

  // Auto-generate actions based on type if none provided
  if (sections.actions.length === 0) {
    sections.actions = inferActions(message);
  }

  // Auto-extract reasoning if not provided
  if (!sections.reasoning) {
    sections.reasoning = inferReasoning(message);
  }

  return sections;
}

function inferActions(message: string): Array<{ label: string; type: string; payload?: Record<string, any> }> {
  const text = message.toLowerCase();
  const actions: Array<{ label: string; type: string; payload?: Record<string, any> }> = [];

  if (text.includes("task") || text.includes("assign") || text.includes("create")) {
    actions.push({ label: "Create Task", type: "create_task" });
  }
  if (text.includes("agent") || text.includes("reassign") || text.includes("workload")) {
    actions.push({ label: "Reassign Work", type: "reassign" });
  }
  if (text.includes("model") || text.includes("switch") || text.includes("upgrade")) {
    actions.push({ label: "Apply Change", type: "apply_change" });
  }
  if (text.includes("review") || text.includes("check") || text.includes("inspect")) {
    actions.push({ label: "Open Review", type: "open_review" });
  }
  if (text.includes("optimize") || text.includes("improve") || text.includes("performance")) {
    actions.push({ label: "Run Optimization", type: "optimize" });
  }

  if (actions.length === 0) {
    actions.push({ label: "Acknowledge", type: "acknowledge" });
  }

  return actions;
}

function inferReasoning(message: string): string {
  const text = message.toLowerCase();
  if (text.includes("bottleneck") || text.includes("overload")) {
    return "Detected workload imbalance that may impact throughput and delivery timelines.";
  }
  if (text.includes("pattern") || text.includes("repeat")) {
    return "Recurring pattern identified that could be automated or optimized.";
  }
  if (text.includes("error") || text.includes("fail")) {
    return "System anomaly detected that requires attention to prevent cascading issues.";
  }
  if (text.includes("complete") || text.includes("done")) {
    return "Task lifecycle event that updates system state and triggers downstream processes.";
  }
  return "System intelligence identified this as relevant to current operational context.";
}

export function InboxMessage({ message: msg, agentName, agents }: InboxMessageProps) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [acting, setActing] = useState(false);

  const typeConfig = TYPE_CONFIG[msg.type] || TYPE_CONFIG.update;
  const StatusIcon = STATUS_ICONS[msg.status] || Eye;
  const sections = parseInboxContent(msg.message, msg.metadata as Record<string, any> | null);

  const updateStatus = async (status: string) => {
    await supabase.from("inbox").update({ status }).eq("id", msg.id);
    if (!msg.read) {
      await supabase.from("inbox").update({ read: true }).eq("id", msg.id);
    }
    queryClient.invalidateQueries({ queryKey: ["inbox-all"] });
    queryClient.invalidateQueries({ queryKey: ["inbox-unread"] });
  };

  const handleExpand = () => {
    const next = !expanded;
    setExpanded(next);
    if (next && msg.status === "unread") {
      updateStatus("opened");
    }
  };

  const handleAction = async (action: { label: string; type: string; payload?: Record<string, any> }) => {
    setActing(true);
    try {
      switch (action.type) {
        case "create_task": {
          const title = action.payload?.title || `From inbox: ${msg.message.slice(0, 60)}`;
          const { data, error } = await supabase.from("tasks").insert({
            title,
            description: msg.message,
            priority: action.payload?.priority || "medium",
            source: "inbox",
          }).select("id").single();

          if (!error && data) {
            try {
              await supabase.functions.invoke("assign-task", { body: { task_id: data.id } });
              toast.success("Task created and auto-assigned");
            } catch {
              toast.success("Task created");
            }
            queryClient.invalidateQueries({ queryKey: ["tasks"] });
          }
          break;
        }
        case "reassign": {
          toast.success("Reassignment analysis started");
          await supabase.functions.invoke("generate-suggestions", {
            body: { type: "workload_rebalance" },
          });
          queryClient.invalidateQueries({ queryKey: ["system-suggestions"] });
          break;
        }
        case "apply_change": {
          toast.success("Change applied to system configuration");
          break;
        }
        case "open_review": {
          toast.success("Review initiated");
          break;
        }
        case "optimize": {
          toast.success("Optimization pipeline triggered");
          await supabase.functions.invoke("generate-suggestions", {
            body: { type: "optimization" },
          });
          queryClient.invalidateQueries({ queryKey: ["system-suggestions"] });
          break;
        }
        case "acknowledge":
        default: {
          toast.success("Acknowledged");
          break;
        }
      }
      await updateStatus("acted");
    } catch (err) {
      toast.error("Action failed");
    } finally {
      setActing(false);
    }
  };

  const handleFeedback = async (value: string) => {
    await supabase.from("inbox").update({ feedback: value }).eq("id", msg.id);
    queryClient.invalidateQueries({ queryKey: ["inbox-all"] });
    toast.success(value === "useful" ? "Marked as useful" : "Feedback recorded");
  };

  const handleDismiss = async () => {
    await updateStatus("dismissed");
    toast.success("Dismissed");
  };

  const handleComplete = async () => {
    await updateStatus("completed");
    toast.success("Marked complete");
  };

  const isActedOrComplete = msg.status === "acted" || msg.status === "completed";

  return (
    <div
      className={`rounded-lg border transition-all duration-200 overflow-hidden ${
        msg.status === "unread"
          ? "border-primary/40 bg-card shadow-sm shadow-primary/5"
          : msg.status === "dismissed"
            ? "border-border/20 bg-card/50 opacity-60"
            : isActedOrComplete
              ? "border-border/30 bg-card/80"
              : "border-border/30 bg-card"
      }`}
    >
      {/* Header row */}
      <div
        onClick={handleExpand}
        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-accent/30 transition-colors"
      >
        {/* Status indicator */}
        <div className={`flex-shrink-0 ${msg.status === "unread" ? "text-primary" : "text-muted-foreground/40"}`}>
          <StatusIcon className="h-4 w-4" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={`text-sm font-medium ${msg.status === "unread" ? "" : "text-muted-foreground"}`}>
              {agentName || msg.from_agent || "System"}
            </span>
            <StatusBadge value={msg.type} />
            {isActedOrComplete && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-medium">
                {msg.status}
              </span>
            )}
            {msg.feedback && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                {msg.feedback === "useful" ? "👍" : "👎"}
              </span>
            )}
          </div>
          <p className={`text-sm truncate ${msg.status === "unread" ? "text-foreground" : "text-muted-foreground"}`}>
            {msg.message}
          </p>
        </div>

        {/* Time + expand */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-muted-foreground/60">
            {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
          </span>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Expanded detail view */}
      {expanded && (
        <div className="border-t border-border/30 animate-fade-in">
          <div className="p-4 space-y-4">
            {/* Overview */}
            <div>
              <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1.5">
                Overview
              </h4>
              <p className="text-sm text-foreground leading-relaxed">{sections.overview}</p>
            </div>

            {/* Reasoning */}
            {sections.reasoning && (
              <div className="rounded-md bg-muted/30 p-3">
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1.5">
                  Reasoning
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">{sections.reasoning}</p>
              </div>
            )}

            {/* Impact */}
            {sections.impact && (
              <div className="rounded-md bg-primary/5 p-3">
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-primary/60 mb-1.5">
                  Impact
                </h4>
                <p className="text-xs text-foreground leading-relaxed">{sections.impact}</p>
              </div>
            )}

            {/* Next Steps */}
            {sections.nextSteps.length > 0 && (
              <div>
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1.5">
                  Next Steps
                </h4>
                <ul className="space-y-1">
                  {sections.nextSteps.map((step, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <ArrowRight className="h-3 w-3 mt-0.5 text-primary/60 flex-shrink-0" />
                      {step}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Links */}
            {sections.links.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {sections.links.map((link, i) => (
                  <a
                    key={i}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {link.label}
                  </a>
                ))}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-2 border-t border-border/20">
              {!isActedOrComplete && sections.actions.map((action, i) => (
                <Button
                  key={i}
                  size="sm"
                  variant={i === 0 ? "default" : "outline"}
                  className="text-xs h-7 gap-1.5"
                  disabled={acting}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAction(action);
                  }}
                >
                  <Zap className="h-3 w-3" />
                  {action.label}
                </Button>
              ))}

              {!isActedOrComplete && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs h-7 text-muted-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDismiss();
                  }}
                >
                  Dismiss
                </Button>
              )}

              {msg.status === "acted" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7 gap-1.5 text-emerald-400 border-emerald-400/30"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleComplete();
                  }}
                >
                  <CheckCircle className="h-3 w-3" />
                  Mark Complete
                </Button>
              )}

              {/* Feedback */}
              <div className="ml-auto flex items-center gap-1">
                {!msg.feedback && (
                  <>
                    <span className="text-[10px] text-muted-foreground/40 mr-1">Useful?</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFeedback("useful");
                      }}
                      className={`p-1 rounded hover:bg-accent transition-colors ${
                        msg.feedback === "useful" ? "text-primary" : "text-muted-foreground/40"
                      }`}
                    >
                      <ThumbsUp className="h-3 w-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFeedback("not_useful");
                      }}
                      className={`p-1 rounded hover:bg-accent transition-colors ${
                        msg.feedback === "not_useful" ? "text-destructive" : "text-muted-foreground/40"
                      }`}
                    >
                      <ThumbsDown className="h-3 w-3" />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
