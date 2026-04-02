import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Lightbulb, Target, RefreshCw, ArrowRight, AlertTriangle, Zap, TrendingUp, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const typeConfig: Record<string, { icon: typeof Lightbulb; color: string; bg: string }> = {
  next_task: { icon: Target, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
  optimization: { icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  reassignment: { icon: ArrowRight, color: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/20" },
  risk: { icon: AlertTriangle, color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
  efficiency: { icon: Zap, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
};

export function PredictivePanel() {
  const [isGenerating, setIsGenerating] = useState(false);
  const queryClient = useQueryClient();

  const { data: suggestions } = useQuery({
    queryKey: ["system-suggestions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("system_suggestions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      return data || [];
    },
    refetchInterval: 60000,
  });

  const generateSuggestions = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-suggestions", { body: {} });
      if (error) throw error;
      toast.success(`Generated ${data.suggestions?.length || 0} new suggestions`);
      queryClient.invalidateQueries({ queryKey: ["system-suggestions"] });
    } catch (e: any) {
      toast.error(e.message || "Failed to generate suggestions");
    } finally {
      setIsGenerating(false);
    }
  };

  const actOnSuggestion = async (id: string, type: string) => {
    await supabase.from("system_suggestions").update({ status: "acted", acted_at: new Date().toISOString() }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["system-suggestions"] });
    toast.success("Suggestion marked as acted upon");
  };

  const pending = suggestions?.filter(s => s.status === "pending") || [];
  const acted = suggestions?.filter(s => s.status === "acted") || [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-amber-400" />
          <h3 className="text-sm font-semibold">Predictive Intelligence</h3>
        </div>
        <Button size="sm" variant="outline" onClick={generateSuggestions} disabled={isGenerating} className="h-7 text-xs">
          {isGenerating ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
          {isGenerating ? "Analyzing..." : "Generate"}
        </Button>
      </div>

      {pending.length === 0 && !isGenerating && (
        <p className="text-xs text-muted-foreground text-center py-3">
          Click Generate to analyze system state and get AI-powered suggestions.
        </p>
      )}

      <div className="space-y-2 max-h-[350px] overflow-y-auto">
        {pending.map(s => {
          const cfg = typeConfig[s.type] || typeConfig.next_task;
          const Icon = cfg.icon;
          return (
            <div key={s.id} className={`rounded-md border p-3 space-y-2 ${cfg.bg}`}>
              <div className="flex items-start gap-2">
                <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${cfg.color}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium">{s.title}</span>
                    <Badge variant="outline" className="text-[9px] px-1 py-0">{s.type.replace("_", " ")}</Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{s.description}</p>
                  {s.affected_agents && s.affected_agents.length > 0 && (
                    <div className="flex gap-1 mt-1.5">
                      {s.affected_agents.map((a: string) => (
                        <span key={a} className="text-[9px] px-1.5 py-0.5 rounded bg-muted/40">{a}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={`text-[10px] font-mono ${s.confidence >= 0.7 ? "text-emerald-400" : s.confidence >= 0.4 ? "text-amber-400" : "text-red-400"}`}>
                    {Math.round(s.confidence * 100)}%
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => actOnSuggestion(s.id, s.type)} className="h-5 text-[10px] px-1.5">
                    Act
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {acted.length > 0 && (
        <div className="space-y-1 pt-2 border-t border-border/20">
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <CheckCircle2 className="h-2.5 w-2.5" /> {acted.length} acted upon
          </p>
        </div>
      )}
    </div>
  );
}
