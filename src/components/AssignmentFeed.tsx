import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Users, Eye, Zap, Filter, Clock, ArrowRight } from "lucide-react";

interface Assignment {
  id: string;
  task_id: string;
  agent_id: string;
  role: string;
  fit_score: number;
  reasoning: string | null;
  claimed_at: string;
}

interface AssignmentFeedProps {
  agentMap: Record<string, string>;
  taskMap: Record<string, string>;
}

const agentAvatarBg: Record<string, string> = {
  hivemind: "bg-violet-500/20 text-violet-400",
  omega: "bg-cyan-500/20 text-cyan-400",
  prism: "bg-pink-500/20 text-pink-400",
  oracle: "bg-amber-500/20 text-amber-400",
  sentinel: "bg-red-500/20 text-red-400",
  hawkeye: "bg-emerald-500/20 text-emerald-400",
  atlas: "bg-sky-500/20 text-sky-400",
};

const agentColors: Record<string, string> = {
  hivemind: "from-violet-500 to-purple-600",
  omega: "from-cyan-500 to-blue-600",
  prism: "from-pink-500 to-rose-600",
  oracle: "from-amber-500 to-orange-600",
  sentinel: "from-red-500 to-rose-700",
  hawkeye: "from-emerald-500 to-green-600",
  atlas: "from-sky-500 to-indigo-600",
};

const roleConfig: Record<string, { label: string; badgeClass: string; icon: typeof Zap }> = {
  owner: { label: "Owner", badgeClass: "bg-blue-500/20 text-blue-400 border-blue-500/40", icon: Zap },
  support: { label: "Support", badgeClass: "bg-amber-500/20 text-amber-400 border-amber-500/40", icon: Users },
  observer: { label: "Observer", badgeClass: "bg-zinc-500/20 text-zinc-400 border-zinc-500/40", icon: Eye },
};

function getAgentKey(agentId: string, agentMap: Record<string, string>): string {
  return (agentMap[agentId] || agentId).toLowerCase();
}

function AgentAvatar({ agentId, agentMap }: { agentId: string; agentMap: Record<string, string> }) {
  const name = agentMap[agentId] || agentId;
  const key = name.toLowerCase();
  const colors = agentAvatarBg[key] || "bg-muted text-muted-foreground";
  return (
    <Avatar className="h-6 w-6">
      <AvatarFallback className={`text-[10px] font-bold ${colors}`}>
        {name.slice(0, 2).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );
}

function RoleBadge({ role }: { role: string }) {
  const config = roleConfig[role] || roleConfig.observer;
  const Icon = config.icon;
  return (
    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${config.badgeClass}`}>
      <Icon className="h-2.5 w-2.5 mr-0.5" />
      {config.label}
    </Badge>
  );
}

/** Compact timeline for a task's assignment lifecycle */
function TaskTimeline({ items, agentMap }: { items: Assignment[]; agentMap: Record<string, string> }) {
  const sorted = [...items].sort((a, b) => new Date(a.claimed_at).getTime() - new Date(b.claimed_at).getTime());
  if (sorted.length <= 1) return null;

  return (
    <div className="flex items-center gap-1 pl-8 overflow-x-auto">
      {sorted.map((item, i) => {
        const name = agentMap[item.agent_id] || item.agent_id;
        const isLast = i === sorted.length - 1;
        return (
          <div key={item.id} className="flex items-center gap-1 shrink-0">
            <div className="flex items-center gap-0.5">
              {item.role === "owner" ? (
                <Zap className="h-2.5 w-2.5 text-blue-400" />
              ) : item.role === "support" ? (
                <Users className="h-2.5 w-2.5 text-amber-400" />
              ) : (
                <Eye className="h-2.5 w-2.5 text-zinc-400" />
              )}
              <span className="text-[9px] text-muted-foreground">{name.slice(0, 3)}</span>
              <span className="text-[8px] text-muted-foreground/60 font-mono">
                {new Date(item.claimed_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            {!isLast && <ArrowRight className="h-2 w-2 text-muted-foreground/30 shrink-0" />}
          </div>
        );
      })}
    </div>
  );
}

export function AssignmentFeed({ agentMap, taskMap }: AssignmentFeedProps) {
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const prevIdsRef = useRef<Set<string>>(new Set());
  const [filterAgent, setFilterAgent] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const { data: assignments, refetch } = useQuery({
    queryKey: ["task-assignments"],
    queryFn: async () => {
      const { data } = await supabase
        .from("task_assignments")
        .select("*")
        .order("claimed_at", { ascending: false })
        .limit(50);
      return (data || []) as Assignment[];
    },
  });

  // Track new IDs for animation
  useEffect(() => {
    if (!assignments) return;
    const currentIds = new Set(assignments.map(a => a.id));
    const fresh = new Set<string>();
    currentIds.forEach(id => {
      if (!prevIdsRef.current.has(id)) fresh.add(id);
    });
    if (fresh.size > 0) {
      setNewIds(fresh);
      const timer = setTimeout(() => setNewIds(new Set()), 700);
      return () => clearTimeout(timer);
    }
    prevIdsRef.current = currentIds;
  }, [assignments]);

  useEffect(() => {
    if (newIds.size === 0 && assignments) {
      prevIdsRef.current = new Set(assignments.map(a => a.id));
    }
  }, [newIds, assignments]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("assignment-feed-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "task_assignments" }, () => refetch())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "task_assignments" }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [refetch]);

  // Apply filters
  const filtered = (assignments || []).filter(a => {
    if (filterAgent && getAgentKey(a.agent_id, agentMap) !== filterAgent) return false;
    if (filterRole && a.role !== filterRole) return false;
    return true;
  });

  const grouped = filtered.reduce<Record<string, Assignment[]>>((acc, a) => {
    if (!acc[a.task_id]) acc[a.task_id] = [];
    acc[a.task_id].push(a);
    return acc;
  }, {});

  const taskIds = Object.keys(grouped);
  const uniqueAgents = [...new Set((assignments || []).map(a => getAgentKey(a.agent_id, agentMap)))].sort();

  if ((assignments || []).length === 0) {
    return (
      <div className="empty-state">
        <p className="text-sm text-muted-foreground">No assignments yet.</p>
        <p className="text-xs text-muted-foreground/60 mt-1">Create a task and watch agents claim it automatically.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Filter bar */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border transition-colors ${
            showFilters || filterAgent || filterRole
              ? "bg-primary/10 text-primary border-primary/30"
              : "text-muted-foreground border-border hover:bg-muted/50"
          }`}
        >
          <Filter className="h-3 w-3" />
          Filters
          {(filterAgent || filterRole) && (
            <span className="ml-1 px-1 rounded-full bg-primary/20 text-[9px] font-bold">
              {[filterAgent, filterRole].filter(Boolean).length}
            </span>
          )}
        </button>
        <span className="text-[10px] text-muted-foreground font-mono">{taskIds.length} tasks</span>
      </div>

      {showFilters && (
        <div className="flex gap-2 flex-wrap animate-fade-in">
          <select
            value={filterAgent}
            onChange={e => setFilterAgent(e.target.value)}
            className="rounded-md border bg-background px-2 py-1 text-[11px]"
          >
            <option value="">All Agents</option>
            {uniqueAgents.map(a => (
              <option key={a} value={a}>{a.charAt(0).toUpperCase() + a.slice(1)}</option>
            ))}
          </select>
          <select
            value={filterRole}
            onChange={e => setFilterRole(e.target.value)}
            className="rounded-md border bg-background px-2 py-1 text-[11px]"
          >
            <option value="">All Roles</option>
            <option value="owner">Owner</option>
            <option value="support">Support</option>
            <option value="observer">Observer</option>
          </select>
          {(filterAgent || filterRole) && (
            <button
              onClick={() => { setFilterAgent(""); setFilterRole(""); }}
              className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Feed items */}
      {taskIds.length === 0 && (filterAgent || filterRole) ? (
        <p className="text-xs text-muted-foreground text-center py-4">No assignments match filters.</p>
      ) : (
        taskIds.slice(0, 12).map((taskId) => {
          const items = grouped[taskId].sort((a, b) => b.fit_score - a.fit_score);
          const owner = items.find(i => i.role === "owner");
          const supporters = items.filter(i => i.role === "support");
          const observers = items.filter(i => i.role === "observer");
          const taskTitle = taskMap[taskId] || "Unknown Task";
          const timestamp = items[0]?.claimed_at;
          const hasNew = items.some(i => newIds.has(i.id));
          const ownerKey = owner ? getAgentKey(owner.agent_id, agentMap) : "";
          const gradient = agentColors[ownerKey] || "from-blue-500 to-blue-600";

          return (
            <div
              key={taskId}
              className={`feed-item space-y-2 transition-all duration-slow ${
                hasNew ? "animate-claim-glow ring-1 ring-primary/20" : ""
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`h-1.5 w-1.5 rounded-full bg-gradient-to-r ${gradient} shrink-0 ${hasNew ? "animate-pulse" : ""}`} />
                  <p className="text-sm font-medium truncate">{taskTitle}</p>
                </div>
                {timestamp && (
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap font-mono tabular-nums flex items-center gap-0.5">
                    <Clock className="h-2.5 w-2.5" />
                    {new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </div>

              {/* Owner */}
              {owner && (
                <div className={`flex items-center gap-2 transition-all duration-300 ${newIds.has(owner.id) ? "animate-fade-in" : ""}`}>
                  <AgentAvatar agentId={owner.agent_id} agentMap={agentMap} />
                  <RoleBadge role="owner" />
                  <span className="text-sm font-medium">{agentMap[owner.agent_id] || owner.agent_id}</span>
                  <span className="text-[10px] text-muted-foreground font-mono tabular-nums ml-auto">{owner.fit_score}%</span>
                </div>
              )}

              {/* Support */}
              {supporters.map(s => (
                <div key={s.id} className={`flex items-center gap-2 transition-all duration-300 ${newIds.has(s.id) ? "animate-fade-in" : ""}`}>
                  <AgentAvatar agentId={s.agent_id} agentMap={agentMap} />
                  <RoleBadge role="support" />
                  <span className="text-xs text-muted-foreground">{agentMap[s.agent_id] || s.agent_id}</span>
                  <span className="text-[10px] text-muted-foreground font-mono tabular-nums ml-auto">{s.fit_score}%</span>
                </div>
              ))}

              {/* Observers */}
              {observers.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-1.5">
                    {observers.slice(0, 3).map(o => (
                      <AgentAvatar key={o.id} agentId={o.agent_id} agentMap={agentMap} />
                    ))}
                  </div>
                  <RoleBadge role="observer" />
                  <span className="text-[10px] text-muted-foreground">{observers.length} watching</span>
                </div>
              )}

              {/* Timeline */}
              <TaskTimeline items={items} agentMap={agentMap} />

              {/* Reasoning */}
              {owner?.reasoning && (
                <p className="text-[11px] text-muted-foreground/80 italic pl-8 leading-relaxed">{owner.reasoning}</p>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
