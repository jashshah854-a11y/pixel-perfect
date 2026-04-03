import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEPT_KEYWORDS: Record<string, string[]> = {
  orchestration: ["coordinate", "plan", "manage", "organize", "workflow", "pipeline", "orchestrate"],
  architecture: ["design", "system", "infrastructure", "scale", "architecture", "database", "schema"],
  frontend: ["ui", "ux", "component", "page", "layout", "style", "interface", "visual", "css", "react"],
  intelligence: ["data", "analysis", "research", "insight", "report", "metric", "ai", "ml", "analytics"],
  security: ["security", "auth", "permission", "encrypt", "audit", "vulnerability"],
  qa: ["test", "quality", "bug", "verify", "validate", "debug", "fix"],
  backend: ["api", "server", "endpoint", "function", "database", "deploy", "edge", "webhook"],
};

const SUB_AGENT_THRESHOLD = 3; // If agent gets more than this many tasks, spawn sub-agents
const ESCALATION_THRESHOLD = 2; // If agent already has this many active tasks, escalate

interface SubtaskInfo {
  title: string;
  description: string;
  keywords: string[];
  priority: string;
  dependencies: string[];
}

function extractSubtasks(title: string, content: string): SubtaskInfo[] {
  const text = `${title} ${content}`.toLowerCase();
  const subtasks: SubtaskInfo[] = [];

  const lines = content.split('\n').filter(l => l.trim());
  const bulletItems: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const headerMatch = trimmed.match(/^#{2,3}\s+(.+)/);
    if (headerMatch) { bulletItems.push(headerMatch[1]); continue; }
    const bulletMatch = trimmed.match(/^[-*]\s+(.+)/);
    if (bulletMatch) { bulletItems.push(bulletMatch[1]); continue; }
    const numMatch = trimmed.match(/^\d+[.)]\s+(.+)/);
    if (numMatch) { bulletItems.push(numMatch[1]); }
  }

  if (bulletItems.length > 0) {
    for (let i = 0; i < Math.min(bulletItems.length, 12); i++) {
      const item = bulletItems[i];
      const itemLower = item.toLowerCase();
      const priority = itemLower.match(/critical|urgent|important|high/) ? "high"
        : itemLower.match(/low|optional|nice/) ? "low" : "medium";
      
      subtasks.push({
        title: item.slice(0, 100),
        description: `Subtask from plan: ${title}`,
        keywords: itemLower.split(/\s+/).filter(w => w.length > 3),
        priority,
        dependencies: i > 0 ? [bulletItems[i - 1].slice(0, 50)] : [],
      });
    }
  }

  if (subtasks.length === 0) {
    const roleSubtasks = [
      { check: /ui|frontend|design|interface|visual|page|dashboard/i, title: `Design UI for: ${title}`, kw: ["ui", "design", "component"] },
      { check: /api|backend|server|database|endpoint|data/i, title: `Build backend for: ${title}`, kw: ["api", "backend", "database"] },
      { check: /test|qa|quality|verify|validate/i, title: `Test and validate: ${title}`, kw: ["test", "quality", "verify"] },
      { check: /security|auth|permission/i, title: `Security review: ${title}`, kw: ["security", "auth"] },
      { check: /research|analyze|data|insight/i, title: `Research: ${title}`, kw: ["research", "analysis"] },
      { check: /deploy|infrastructure|scale/i, title: `Infrastructure: ${title}`, kw: ["deploy", "infrastructure"] },
    ];

    for (const rs of roleSubtasks) {
      if (rs.check.test(text)) {
        subtasks.push({ title: rs.title, description: `Auto-generated from plan: ${title}`, keywords: rs.kw, priority: "medium", dependencies: [] });
      }
    }

    if (subtasks.length === 0) {
      subtasks.push(
        { title: `Plan and coordinate: ${title}`, description: `Orchestration`, keywords: ["coordinate", "plan"], priority: "high", dependencies: [] },
        { title: `Design and build: ${title}`, description: `Core implementation`, keywords: ["design", "build"], priority: "medium", dependencies: [] },
        { title: `Review and validate: ${title}`, description: `Quality check`, keywords: ["test", "verify"], priority: "medium", dependencies: [] },
      );
    }
  }

  return subtasks;
}

function matchAgentDept(keywords: string[], dept: string): number {
  const deptKw = DEPT_KEYWORDS[dept.toLowerCase()] || [];
  return keywords.filter(k => deptKw.includes(k)).length;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { plan_id } = await req.json();
    if (!plan_id) throw new Error("plan_id required");

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Load plan, agents, and current workloads in parallel
    const [planRes, agentsRes, activeTasksRes] = await Promise.all([
      supabase.from('plans').select('*').eq('id', plan_id).single(),
      supabase.from('agents').select('*'),
      supabase.from('tasks').select('assigned_to, status').in('status', ['in_progress', 'queued']),
    ]);

    if (planRes.error || !planRes.data) throw new Error("Plan not found");
    const plan = planRes.data;
    const agents = agentsRes.data || [];
    const activeTasks = activeTasksRes.data || [];

    // Calculate current workload per agent
    const workload: Record<string, number> = {};
    for (const t of activeTasks) {
      if (t.assigned_to) workload[t.assigned_to] = (workload[t.assigned_to] || 0) + 1;
    }

    const omega = agents.find(a => a.name.toLowerCase().includes('omega'));
    const subtasks = extractSubtasks(plan.title, plan.markdown_content || "");

    // ===== PHASE 1: Route subtasks to primary agents =====
    const agentTaskCounts: Record<string, number> = {};
    const routing: Array<{ subtask: SubtaskInfo; primaryAgent: typeof agents[0]; score: number }> = [];

    for (const sub of subtasks) {
      let bestAgent = omega || agents[0];
      let bestScore = 0;

      for (const agent of agents) {
        const dept = agent.department.toLowerCase();
        const kwMatch = matchAgentDept(sub.keywords, dept);
        let score = kwMatch * 15;
        if (agent.status === 'idle') score += 10;
        // Penalize overloaded agents
        const currentLoad = (workload[agent.id] || 0) + (agentTaskCounts[agent.id] || 0);
        score -= currentLoad * 5;
        if (score > bestScore) {
          bestScore = score;
          bestAgent = agent;
        }
      }

      routing.push({ subtask: sub, primaryAgent: bestAgent, score: bestScore });
      agentTaskCounts[bestAgent.id] = (agentTaskCounts[bestAgent.id] || 0) + 1;
    }

    // ===== PHASE 2: Detect overloaded agents → spawn sub-agents =====
    const subAgentSpawns: Array<{
      parentAgent: string;
      parentName: string;
      subAgentId: string;
      subAgentName: string;
      reason: string;
      delegatedTasks: string[];
    }> = [];
    const escalations: Array<{
      agentId: string;
      agentName: string;
      reason: string;
      action: string;
    }> = [];

    const overloadedAgents = Object.entries(agentTaskCounts).filter(([, count]) => count > SUB_AGENT_THRESHOLD);

    for (const [agentId, taskCount] of overloadedAgents) {
      const agent = agents.find(a => a.id === agentId);
      if (!agent) continue;

      // Determine how many sub-agents to spawn
      const subAgentCount = Math.ceil((taskCount - SUB_AGENT_THRESHOLD) / 2);
      const agentTasks = routing.filter(r => r.primaryAgent.id === agentId);

      for (let i = 0; i < Math.min(subAgentCount, 3); i++) {
        const subAgentId = `sub-${agent.id}-${Date.now()}-${i}`;
        const subAgentName = `${agent.name} Sub-${i + 1}`;
        
        // Delegate lower-priority tasks to sub-agent
        const delegatable = agentTasks
          .filter(t => t.subtask.priority !== 'high')
          .slice(i * 2, (i + 1) * 2);

        if (delegatable.length > 0) {
          // Re-route these tasks to the sub-agent conceptually
          for (const d of delegatable) {
            d.primaryAgent = { ...agent, id: subAgentId, name: subAgentName } as any;
          }

          subAgentSpawns.push({
            parentAgent: agentId,
            parentName: agent.name,
            subAgentId,
            subAgentName,
            reason: `${agent.name} has ${taskCount} tasks (threshold: ${SUB_AGENT_THRESHOLD}). Spawning sub-agent for load distribution.`,
            delegatedTasks: delegatable.map(d => d.subtask.title),
          });
        }
      }

      // Also escalate if current workload is already high
      if ((workload[agentId] || 0) >= ESCALATION_THRESHOLD) {
        escalations.push({
          agentId,
          agentName: agent.name,
          reason: `${agent.name} already has ${workload[agentId]} active tasks plus ${taskCount} new assignments.`,
          action: "Requesting HiveMind support for parallel execution.",
        });
      }
    }

    // ===== PHASE 3: Create tasks and assignments =====
    const taskInserts = [];

    // Coordination task for Omega
    if (omega) {
      taskInserts.push({
        title: `Orchestrate: ${plan.title}`,
        description: `Omega coordinates execution of plan: ${plan.title}. ${subAgentSpawns.length > 0 ? `Spawned ${subAgentSpawns.length} sub-agents for load distribution.` : ''}`,
        priority: 'high',
        status: 'in_progress',
        source: 'plan',
      });
    }

    // All subtasks
    for (const r of routing) {
      taskInserts.push({
        title: r.subtask.title,
        description: r.subtask.description,
        priority: r.subtask.priority,
        status: 'queued',
        source: 'plan',
      });
    }

    const { data: createdTasks, error: insertErr } = await supabase
      .from('tasks')
      .insert(taskInserts)
      .select('id, title');

    if (insertErr || !createdTasks) throw new Error("Failed to create tasks");

    const results: any[] = [];
    let subtaskStartIdx = 0;

    // Handle Omega coordination task
    if (omega) {
      const coordTask = createdTasks[0];
      await supabase.from('task_assignments').insert({
        task_id: coordTask.id,
        agent_id: omega.id,
        role: 'owner',
        fit_score: 100,
        reasoning: 'Omega is the primary orchestrator for all plan decomposition.',
      });
      await supabase.from('tasks').update({ assigned_to: omega.id }).eq('id', coordTask.id);
      results.push({
        task_id: coordTask.id,
        title: coordTask.title,
        owner: omega.id,
        owner_name: omega.name,
        type: 'coordination',
        assignments: [{ agent_id: omega.id, role: 'owner' }],
      });
      subtaskStartIdx = 1;
    }

    // Assign subtasks via assign-task function in parallel
    const assignUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/assign-task`;
    const assignHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
    };

    const assignPromises = createdTasks.slice(subtaskStartIdx).map(async (task, i) => {
      try {
        const res = await fetch(assignUrl, {
          method: 'POST',
          headers: assignHeaders,
          body: JSON.stringify({ task_id: task.id }),
        });
        const data = await res.json();
        
        const routeInfo = routing[i];
        return {
          task_id: task.id,
          title: task.title,
          owner: data.owner || null,
          owner_name: data.owner_name || null,
          type: 'subtask',
          priority: routeInfo?.subtask.priority || 'medium',
          delegatedTo: routeInfo?.primaryAgent.id.startsWith('sub-') ? routeInfo.primaryAgent.name : null,
          assignments: data.assignments || [],
        };
      } catch {
        return { task_id: task.id, title: task.title, owner: null, owner_name: null, type: 'subtask', priority: 'medium', delegatedTo: null, assignments: [] };
      }
    });

    const assignResults = await Promise.all(assignPromises);
    results.push(...assignResults);

    // ===== PHASE 4: Research triggers =====
    const researchTriggers: Array<{ agentId: string; agentName: string; topic: string }> = [];
    const oracle = agents.find(a => a.name.toLowerCase().includes('oracle'));
    
    if (oracle) {
      // Check if plan involves research-heavy tasks
      const planText = `${plan.title} ${plan.markdown_content || ''}`.toLowerCase();
      if (planText.match(/research|analyze|compare|evaluate|benchmark|strategy|optimize/)) {
        researchTriggers.push({
          agentId: oracle.id,
          agentName: oracle.name,
          topic: `Research context for plan: ${plan.title}`,
        });

        // Trigger agent-research
        try {
          await supabase.functions.invoke("agent-research", {
            body: { agent_id: oracle.id, topic: plan.title, plan_context: plan.markdown_content?.slice(0, 500) },
          });
        } catch {
          // Research is best-effort
        }
      }
    }

    // ===== PHASE 5: Update plan status + notifications =====
    const inboxMessages = [
      {
        from_agent: omega?.id || 'omega',
        message: `Plan "${plan.title}" decomposed into ${results.length} tasks across ${[...new Set(results.map(r => r.owner).filter(Boolean))].length} agents.${subAgentSpawns.length > 0 ? ` ${subAgentSpawns.length} sub-agents spawned.` : ''}${escalations.length > 0 ? ` ${escalations.length} escalations triggered.` : ''}`,
        type: 'plan_decompose',
        metadata: JSON.stringify({
          reasoning: `Plan was analyzed and broken into ${subtasks.length} actionable subtasks based on content structure and keyword analysis.`,
          impact: `${results.length} tasks created, ${subAgentSpawns.length} sub-agents spawned, ${escalations.length} escalations.`,
          next_steps: results.slice(0, 3).map(r => `${r.owner_name || 'Unassigned'}: ${r.title}`),
        }),
      },
    ];

    // Add escalation notifications
    for (const esc of escalations) {
      inboxMessages.push({
        from_agent: esc.agentId,
        message: `⚠️ ${esc.reason} ${esc.action}`,
        type: 'alert',
        metadata: JSON.stringify({
          reasoning: esc.reason,
          impact: 'Workload imbalance may delay task completion.',
          actions: [{ label: 'Rebalance', type: 'reassign' }],
        }),
      });
    }

    // Add sub-agent spawn notifications
    for (const spawn of subAgentSpawns) {
      inboxMessages.push({
        from_agent: spawn.parentAgent,
        message: `${spawn.parentName} spawned sub-agent "${spawn.subAgentName}" to handle: ${spawn.delegatedTasks.join(', ')}`,
        type: 'update',
        metadata: JSON.stringify({
          reasoning: spawn.reason,
          impact: `${spawn.delegatedTasks.length} tasks delegated to sub-agent for parallel execution.`,
        }),
      });
    }

    // Add research trigger notifications
    for (const rt of researchTriggers) {
      inboxMessages.push({
        from_agent: rt.agentId,
        message: `${rt.agentName} initiated research: ${rt.topic}`,
        type: 'update',
        metadata: JSON.stringify({
          reasoning: 'Plan content suggests research would improve execution quality.',
          impact: 'External intelligence will be fed back into task routing.',
        }),
      });
    }

    await Promise.all([
      supabase.from('plans').update({ status: 'executing' }).eq('id', plan_id),
      supabase.from('inbox').insert(inboxMessages),
    ]);

    return new Response(JSON.stringify({
      ok: true,
      subtasks: results,
      orchestration: {
        primaryAgents: [...new Set(results.map(r => r.owner_name).filter(Boolean))],
        subAgentSpawns,
        escalations,
        researchTriggers,
        totalTasks: results.length,
        delegationChains: results.filter(r => r.delegatedTo).map(r => ({
          task: r.title,
          from: r.owner_name,
          to: r.delegatedTo,
        })),
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
