import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { AgentCard } from "@/components/AgentCard";
import { TaskForm } from "@/components/TaskForm";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";

export default function AgentsPage() {
  const queryClient = useQueryClient();
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string | undefined>();

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

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await supabase.from("agents").update({ status }).eq("id", id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["agents"] }),
  });

  const createTask = useMutation({
    mutationFn: async (task: { title: string; description: string; priority: string; assigned_to: string | null; source: string }) => {
      await supabase.from("tasks").insert(task);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });

  return (
    <Layout totalTokens={totalTokens} unreadCount={allInbox?.length || 0}>
      <div className="space-y-5 p-1">
        <PageHeader
          eyebrow="Roster · Live"
          title="Agents"
          description={`${agents?.length ?? 0} autonomous operators online`}
        />
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {agents?.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onStatusChange={(id, status) => updateStatus.mutate({ id, status })}
                onAssignTask={(id) => {
                  setSelectedAgent(id);
                  setTaskFormOpen(true);
                }}
              />
            ))}
          </div>
        )}
      </div>

      <TaskForm
        open={taskFormOpen}
        onClose={() => setTaskFormOpen(false)}
        agents={agents || []}
        defaultAgent={selectedAgent}
        onSubmit={(task) => createTask.mutate(task)}
      />
    </Layout>
  );
}
