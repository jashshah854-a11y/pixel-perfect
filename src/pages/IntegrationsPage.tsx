import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { Plug, Wifi, WifiOff, AlertTriangle, Clock, ExternalLink, Settings2 } from "lucide-react";
import { toast } from "sonner";

const categoryOrder = [
  "AI IDE", "AI Model", "AI Agent", "AI Search", "Infrastructure",
  "Job Pipeline", "Scraping", "Automation", "UI Builder",
  "Database", "Version Control", "Email",
];

const statusConfig: Record<string, { color: string; icon: typeof Wifi; label: string }> = {
  active: { color: "bg-green-500", icon: Wifi, label: "Active" },
  available: { color: "bg-yellow-500", icon: Clock, label: "Available" },
  needs_setup: { color: "bg-red-500", icon: AlertTriangle, label: "Needs Setup" },
  disconnected: { color: "bg-muted-foreground/40", icon: WifiOff, label: "Disconnected" },
};

export default function IntegrationsPage() {
  const queryClient = useQueryClient();
  const [testingId, setTestingId] = useState<string | null>(null);

  const { data: tools, isLoading } = useQuery({
    queryKey: ["tool_connections"],
    queryFn: async () => {
      const { data } = await supabase.from("tool_connections").select("*");
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

  const { data: allInbox } = useQuery({
    queryKey: ["inbox-unread"],
    queryFn: async () => {
      const { data } = await supabase.from("inbox").select("id").eq("read", false);
      return data || [];
    },
  });

  const totalTokens = agents?.reduce((sum, a) => sum + a.tokens_used, 0) || 0;

  const testConnection = async (tool: any) => {
    setTestingId(tool.id);
    try {
      let reachable = false;
      let message = "Manual verification needed";

      if (tool.id === "ghost-sweep" && tool.api_url) {
        try {
          const res = await fetch(`${tool.api_url}/health`);
          reachable = res.ok;
          message = reachable ? "Health check passed" : "Health check failed";
        } catch { message = "Unreachable"; }
      } else if (tool.id === "neon-db") {
        try {
          const res = await supabase.functions.invoke("sync-neon-stats");
          reachable = !res.error;
          message = reachable ? "Neon connection alive" : "Neon connection failed";
        } catch { message = "Edge function error"; }
      } else if (tool.api_url) {
        try {
          const res = await fetch(tool.api_url, { method: "HEAD", mode: "no-cors" });
          reachable = true;
          message = "Endpoint reachable (no-cors)";
        } catch { message = "Unreachable"; }
      }

      await supabase.from("tool_connections").update({ last_ping: new Date().toISOString() }).eq("id", tool.id);
      queryClient.invalidateQueries({ queryKey: ["tool_connections"] });

      if (reachable) {
        toast.success(`${tool.name}: ${message}`);
      } else {
        toast.info(`${tool.name}: ${message}`);
      }
    } catch {
      toast.error(`Failed to test ${tool.name}`);
    } finally {
      setTestingId(null);
    }
  };

  const grouped = categoryOrder.reduce<Record<string, any[]>>((acc, cat) => {
    const items = tools?.filter((t) => t.category === cat) || [];
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {});

  const activeCount = tools?.filter((t) => t.status === "active").length || 0;
  const availableCount = tools?.filter((t) => t.status === "available").length || 0;
  const needsSetupCount = tools?.filter((t) => t.status === "needs_setup").length || 0;

  return (
    <Layout totalTokens={totalTokens} unreadCount={allInbox?.length || 0}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Plug className="h-5 w-5" /> Integrations
          </h2>
          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500 inline-block" /> {activeCount} active</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-yellow-500 inline-block" /> {availableCount} available</span>
            {needsSetupCount > 0 && (
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500 inline-block" /> {needsSetupCount} needs setup</span>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-36 rounded-lg" />
            ))}
          </div>
        ) : (
          Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">{category}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map((tool) => {
                  const st = statusConfig[tool.status] || statusConfig.disconnected;
                  const config = tool.config as Record<string, any> || {};
                  return (
                    <div key={tool.id} className="rounded-lg border bg-card p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`h-2.5 w-2.5 rounded-full ${st.color} shrink-0`} />
                          <div>
                            <p className="text-sm font-medium">{tool.name}</p>
                            <p className="text-xs text-muted-foreground">{tool.category}</p>
                          </div>
                        </div>
                        <StatusBadge value={tool.status} />
                      </div>

                      {tool.notes && (
                        <p className="text-xs text-muted-foreground line-clamp-1">{tool.notes}</p>
                      )}

                      {tool.api_url && (
                        <p className="text-xs font-mono text-muted-foreground truncate" title={tool.api_url}>
                          {tool.api_url}
                        </p>
                      )}

                      {config.role && (
                        <p className="text-xs text-muted-foreground italic">{config.role}</p>
                      )}

                      {tool.last_ping && (
                        <p className="text-[10px] text-muted-foreground">
                          Last ping: {new Date(tool.last_ping).toLocaleString()}
                        </p>
                      )}

                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => testConnection(tool)}
                          disabled={testingId === tool.id}
                          className="text-xs rounded-md border px-2 py-1 hover:bg-muted/50 transition-colors disabled:opacity-50"
                        >
                          {testingId === tool.id ? "Testing..." : "Test Connection"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}

        {tools && tools.length === 0 && (
          <p className="text-sm text-muted-foreground">No integrations configured.</p>
        )}
      </div>
    </Layout>
  );
}
