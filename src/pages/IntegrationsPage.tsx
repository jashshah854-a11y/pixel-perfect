import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Plug, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

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

const dotColor: Record<string, string> = {
  active: "bg-green-500",
  available: "bg-yellow-500",
  needs_setup: "bg-red-500",
  error: "bg-red-500",
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
        toast.error(data.message);
      }
    } catch (err: any) {
      toast.error(`Test failed: ${err.message}`);
    } finally {
      setTestingId(null);
    }
  };

  // Group tools by category
  const grouped = (tools || []).reduce<Record<string, typeof tools>>((acc, tool) => {
    const cat = tool.category || "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat]!.push(tool);
    return acc;
  }, {});

  const sortedCategories = Object.keys(grouped).sort();

  const activeCount = tools?.filter((t) => t.status === "active").length || 0;
  const availableCount = tools?.filter((t) => t.status === "available").length || 0;
  const errorCount = tools?.filter((t) => t.status === "needs_setup" || t.status === "error").length || 0;

  return (
    <Layout totalTokens={totalTokens} unreadCount={allInbox?.length || 0}>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-xl font-semibold">Integrations</h2>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 inline-block" />
              {activeCount} active
            </span>
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-yellow-500 inline-block" />
              {availableCount} available
            </span>
            {errorCount > 0 && (
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500 inline-block" />
                {errorCount} error
              </span>
            )}
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 rounded-md" />
            ))}
          </div>
        ) : (
          sortedCategories.map((category) => (
            <div key={category}>
              <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
                {category}
              </h3>
              <Accordion type="single" collapsible className="border rounded-lg divide-y divide-border">
                {grouped[category]!.map((tool) => {
                  const dot = dotColor[tool.status || ""] || "bg-muted-foreground/40";
                  const config = (tool.config as Record<string, any>) || {};
                  return (
                    <AccordionItem key={tool.id} value={tool.id} className="border-0">
                      <AccordionTrigger className="px-3 py-2.5 hover:no-underline hover:bg-muted/30 text-sm">
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          <span className={`h-2 w-2 rounded-full ${dot} shrink-0`} />
                          <span className="truncate font-normal">{tool.name}</span>
                          <span className="ml-auto text-[10px] text-muted-foreground/60 font-mono shrink-0 mr-2">
                            {relativeTime(tool.last_ping)}
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-3 pb-3">
                        <div className="space-y-3 pt-1">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-muted-foreground">Status:</span>
                            <span className="capitalize">{tool.status}</span>
                          </div>
                          {tool.api_url && (
                            <div>
                              <span className="text-[10px] text-muted-foreground block mb-0.5">API URL</span>
                              <p className="text-xs font-mono bg-muted/30 rounded px-2 py-1.5 break-all">{tool.api_url}</p>
                            </div>
                          )}
                          {tool.notes && (
                            <div>
                              <span className="text-[10px] text-muted-foreground block mb-0.5">Description</span>
                              <p className="text-xs">{tool.notes}</p>
                            </div>
                          )}
                          {config.role && (
                            <div>
                              <span className="text-[10px] text-muted-foreground block mb-0.5">Role</span>
                              <p className="text-xs italic">{config.role}</p>
                            </div>
                          )}
                          {Object.keys(config).length > 0 && (
                            <div>
                              <span className="text-[10px] text-muted-foreground block mb-0.5">Config</span>
                              <pre className="text-[10px] font-mono bg-muted/30 rounded px-2 py-1.5 overflow-x-auto whitespace-pre-wrap">
                                {JSON.stringify(config, null, 2)}
                              </pre>
                            </div>
                          )}
                          <button
                            onClick={() => testConnection(tool.id)}
                            disabled={testingId === tool.id}
                            className="rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                          >
                            {testingId === tool.id ? (
                              <><Loader2 className="h-3 w-3 animate-spin" /> Testing...</>
                            ) : (
                              <><Plug className="h-3 w-3" /> Test Connection</>
                            )}
                          </button>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </div>
          ))
        )}

        {!isLoading && sortedCategories.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No integrations configured.</p>
        )}
      </div>
    </Layout>
  );
}
