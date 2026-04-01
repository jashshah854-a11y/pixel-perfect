import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useState } from "react";
import { Plug, Loader2 } from "lucide-react";
import { toast } from "sonner";

const categories = [
  "All", "AI IDE", "AI Model", "AI Agent", "Infrastructure",
  "Job Pipeline", "Scraping", "Automation", "UI Builder",
  "Database", "Version Control", "Email",
];

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return "never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const statusDot: Record<string, string> = {
  active: "bg-green-500",
  available: "bg-yellow-500",
  needs_setup: "bg-red-500",
  error: "bg-red-500",
};

export default function IntegrationsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("All");
  const [testingId, setTestingId] = useState<string | null>(null);
  const [selectedTool, setSelectedTool] = useState<any>(null);

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

  const testConnection = async (toolId: string) => {
    setTestingId(toolId);
    try {
      const { data, error } = await supabase.functions.invoke("test-connection", {
        body: { tool_id: toolId },
      });

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["tool_connections"] });

      if (data.success) {
        toast.success(`${data.message} (${data.latency_ms}ms)`);
      } else {
        toast.error(`${data.message}`);
      }
    } catch (err: any) {
      toast.error(`Test failed: ${err.message}`);
    } finally {
      setTestingId(null);
    }
  };

  const filtered = activeTab === "All"
    ? tools
    : tools?.filter((t) => t.category === activeTab);

  const activeCount = tools?.filter((t) => t.status === "active").length || 0;
  const availableCount = tools?.filter((t) => t.status === "available").length || 0;
  const errorCount = tools?.filter((t) => t.status === "needs_setup" || t.status === "error").length || 0;

  // Tab counts
  const tabCounts = categories.reduce<Record<string, number>>((acc, cat) => {
    acc[cat] = cat === "All" ? (tools?.length || 0) : (tools?.filter((t) => t.category === cat).length || 0);
    return acc;
  }, {});

  return (
    <Layout totalTokens={totalTokens} unreadCount={allInbox?.length || 0}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Plug className="h-5 w-5" /> Integrations
          </h2>
          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-green-500 inline-block" /> {activeCount} active
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-yellow-500 inline-block" /> {availableCount} available
            </span>
            {errorCount > 0 && (
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-red-500 inline-block" /> {errorCount} error
              </span>
            )}
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
          {categories.map((cat) => {
            const count = tabCounts[cat] || 0;
            if (cat !== "All" && count === 0) return null;
            return (
              <button
                key={cat}
                onClick={() => setActiveTab(cat)}
                className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeTab === cat
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                }`}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {filtered?.map((tool) => {
              const dot = statusDot[tool.status] || "bg-muted-foreground/40";
              const config = (tool.config as Record<string, any>) || {};
              return (
                <button
                  key={tool.id}
                  onClick={() => setSelectedTool(tool)}
                  className="rounded-lg border bg-card p-3 text-left space-y-2 hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`h-2 w-2 rounded-full ${dot} shrink-0`} />
                      <span className="text-sm font-medium truncate">{tool.name}</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        testConnection(tool.id);
                      }}
                      disabled={testingId === tool.id}
                      className="shrink-0 rounded-md border p-1 hover:bg-muted/50 transition-colors disabled:opacity-50"
                      title="Test connection"
                    >
                      {testingId === tool.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Plug className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">{tool.category}</p>
                  {config.role && (
                    <p className="text-xs text-muted-foreground truncate">{config.role}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground/60">
                    {relativeTime(tool.last_ping)}
                  </p>
                </button>
              );
            })}
          </div>
        )}

        {filtered && filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No integrations in this category.</p>
        )}
      </div>

      {/* Detail Sheet */}
      <Sheet open={!!selectedTool} onOpenChange={(open) => !open && setSelectedTool(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {selectedTool && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${statusDot[selectedTool.status] || "bg-muted-foreground/40"}`} />
                  {selectedTool.name}
                </SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Category:</span>
                  <span className="text-sm">{selectedTool.category}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Status:</span>
                  <StatusBadge value={selectedTool.status} />
                </div>
                {selectedTool.api_url && (
                  <div>
                    <span className="text-xs text-muted-foreground block mb-1">API URL</span>
                    <p className="text-xs font-mono bg-muted/50 rounded p-2 break-all">{selectedTool.api_url}</p>
                  </div>
                )}
                {selectedTool.notes && (
                  <div>
                    <span className="text-xs text-muted-foreground block mb-1">Description</span>
                    <p className="text-sm">{selectedTool.notes}</p>
                  </div>
                )}
                {(selectedTool.config as Record<string, any>)?.role && (
                  <div>
                    <span className="text-xs text-muted-foreground block mb-1">Role</span>
                    <p className="text-sm italic">{(selectedTool.config as Record<string, any>).role}</p>
                  </div>
                )}
                <div>
                  <span className="text-xs text-muted-foreground block mb-1">Last Ping</span>
                  <p className="text-sm">
                    {selectedTool.last_ping
                      ? `${relativeTime(selectedTool.last_ping)} — ${new Date(selectedTool.last_ping).toLocaleString()}`
                      : "Never tested"}
                  </p>
                </div>

                {/* Config details */}
                {selectedTool.config && Object.keys(selectedTool.config as Record<string, any>).length > 0 && (
                  <div>
                    <span className="text-xs text-muted-foreground block mb-1">Config</span>
                    <pre className="text-[10px] font-mono bg-muted/50 rounded p-2 overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(selectedTool.config, null, 2)}
                    </pre>
                  </div>
                )}

                <button
                  onClick={() => testConnection(selectedTool.id)}
                  disabled={testingId === selectedTool.id}
                  className="w-full rounded-md bg-primary text-primary-foreground py-2 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {testingId === selectedTool.id ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Testing...
                    </>
                  ) : (
                    <>
                      <Plug className="h-4 w-4" /> Test Connection
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </Layout>
  );
}
