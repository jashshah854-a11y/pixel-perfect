import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Bot, Pause, Play, Loader2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";

export function AutonomousControl() {
  const [enabled, setEnabled] = useState(() => localStorage.getItem("autonomous-mode") === "true");
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const queryClient = useQueryClient();

  const { data: recentActions } = useQuery({
    queryKey: ["autonomous-actions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("autonomous_actions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(8);
      return data || [];
    },
    refetchInterval: 30000,
  });

  const runTick = async () => {
    setIsRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("autonomous-tick", { body: {} });
      if (error) throw error;
      if (data.actions_taken > 0) {
        toast.info(`Autonomous: ${data.actions_taken} action${data.actions_taken > 1 ? "s" : ""} taken`);
      }
      queryClient.invalidateQueries({ queryKey: ["autonomous-actions"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    } catch (e: any) {
      toast.error(`Autonomous error: ${e.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  useEffect(() => {
    localStorage.setItem("autonomous-mode", String(enabled));
    if (enabled) {
      runTick();
      intervalRef.current = setInterval(runTick, 90000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled]);

  const actionTypeIcons: Record<string, string> = {
    auto_assign: "🎯",
    hivemind_dispatch: "🧠",
    stale_warning: "⏰",
    auto_assign_failed: "❌",
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className={`h-4 w-4 ${enabled ? "text-emerald-400" : "text-muted-foreground"}`} />
          <h3 className="text-sm font-semibold">Autonomous Mode</h3>
          {enabled && <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />}
        </div>
        <div className="flex items-center gap-2">
          {isRunning && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          <Button
            size="sm"
            variant={enabled ? "default" : "outline"}
            onClick={() => setEnabled(!enabled)}
            className="h-7 text-xs"
          >
            {enabled ? <><Pause className="h-3 w-3 mr-1" /> Pause</> : <><Play className="h-3 w-3 mr-1" /> Enable</>}
          </Button>
        </div>
      </div>

      {enabled && (
        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Clock className="h-2.5 w-2.5" />
          Auto-tick every 90s • Max 3 tasks per tick • No destructive actions
        </div>
      )}

      {recentActions && recentActions.length > 0 && (
        <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
          <p className="text-[11px] font-medium text-muted-foreground">Recent Actions</p>
          {recentActions.map(a => (
            <div key={a.id} className="flex items-start gap-2 px-2.5 py-1.5 rounded-md bg-muted/20 text-[11px]">
              <span className="shrink-0">{actionTypeIcons[a.action_type] || "⚡"}</span>
              <span className="flex-1">{a.description}</span>
              <span className="text-muted-foreground/60 shrink-0 text-[9px]">
                {format(new Date(a.created_at), "HH:mm")}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
