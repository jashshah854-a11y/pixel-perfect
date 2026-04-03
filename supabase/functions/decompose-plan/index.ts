import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function extractSubtasks(title: string, content: string): { title: string; description: string; keywords: string[] }[] {
  const text = `${title} ${content}`.toLowerCase();
  const subtasks: { title: string; description: string; keywords: string[] }[] = [];

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
    for (const item of bulletItems.slice(0, 8)) {
      subtasks.push({
        title: item.slice(0, 100),
        description: `Subtask from plan: ${title}`,
        keywords: item.toLowerCase().split(/\s+/).filter(w => w.length > 3),
      });
    }
  }

  if (subtasks.length === 0) {
    const roleSubtasks = [
      { check: /ui|frontend|design|interface|visual|page|dashboard/i, title: `Design UI for: ${title}`, keywords: ["ui", "design", "component", "interface"] },
      { check: /api|backend|server|database|endpoint|data/i, title: `Build backend for: ${title}`, keywords: ["api", "backend", "database", "endpoint"] },
      { check: /test|qa|quality|verify|validate/i, title: `Test and validate: ${title}`, keywords: ["test", "quality", "verify", "validate"] },
      { check: /security|auth|permission|access/i, title: `Security review: ${title}`, keywords: ["security", "auth", "permission"] },
      { check: /research|analyze|data|insight/i, title: `Research and analyze: ${title}`, keywords: ["research", "analysis", "data", "insight"] },
      { check: /plan|coordinate|manage|organize/i, title: `Coordinate execution: ${title}`, keywords: ["coordinate", "plan", "manage", "organize"] },
      { check: /deploy|infrastructure|scale|devops/i, title: `Infrastructure setup: ${title}`, keywords: ["deploy", "infrastructure", "scale"] },
    ];

    for (const rs of roleSubtasks) {
      if (rs.check.test(text)) {
        subtasks.push({ title: rs.title, description: `Auto-generated from plan: ${title}`, keywords: rs.keywords });
      }
    }

    if (subtasks.length > 0 && subtasks.length < 6) {
      if (!subtasks.some(s => s.keywords.includes("coordinate"))) {
        subtasks.unshift({ title: `Coordinate: ${title}`, description: `Orchestration for plan: ${title}`, keywords: ["coordinate", "plan", "manage"] });
      }
      if (!subtasks.some(s => s.keywords.includes("test"))) {
        subtasks.push({ title: `QA validation: ${title}`, description: `Quality assurance for plan: ${title}`, keywords: ["test", "quality", "verify"] });
      }
    }

    if (subtasks.length === 0) {
      subtasks.push(
        { title: `Plan and coordinate: ${title}`, description: `Orchestration`, keywords: ["coordinate", "plan", "manage"] },
        { title: `Design and build: ${title}`, description: `Core implementation`, keywords: ["design", "build", "component"] },
        { title: `Review and validate: ${title}`, description: `Quality check`, keywords: ["test", "quality", "verify"] },
      );
    }
  }

  return subtasks;
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

    // Load plan + agents in parallel
    const [planRes, agentsRes] = await Promise.all([
      supabase.from('plans').select('*').eq('id', plan_id).single(),
      supabase.from('agents').select('id, name, role').or('name.ilike.%omega%,role.ilike.%orchestrat%'),
    ]);

    if (planRes.error || !planRes.data) throw new Error("Plan not found");
    const plan = planRes.data;
    const omega = (agentsRes.data || [])[0] || null;

    const subtasks = extractSubtasks(plan.title, plan.markdown_content || "");

    const results: any[] = [];

    // Batch-insert all subtasks + coordination task in one call
    const taskInserts = subtasks.map(sub => ({
      title: sub.title,
      description: sub.description,
      priority: 'medium',
      status: 'queued',
      source: 'plan',
    }));

    // Add coordination task for Omega
    if (omega) {
      taskInserts.unshift({
        title: `Orchestrate: ${plan.title}`,
        description: `Omega coordinates execution of plan: ${plan.title}`,
        priority: 'high',
        status: 'in_progress',
        source: 'plan',
      });
    }

    // Single batch insert for all tasks
    const { data: createdTasks, error: insertErr } = await supabase
      .from('tasks')
      .insert(taskInserts)
      .select('id, title');

    if (insertErr || !createdTasks) throw new Error("Failed to create tasks");

    // Handle Omega coordination task (first in array if omega exists)
    let subtaskStartIdx = 0;
    if (omega) {
      const coordTask = createdTasks[0];
      // Assign Omega directly — no need to call assign-task
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
        assignments: [{ agent_id: omega.id, role: 'owner' }],
      });
      subtaskStartIdx = 1;
    }

    // Parallel assign-task calls for all subtasks
    const assignUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/assign-task`;
    const assignHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
    };

    const assignPromises = createdTasks.slice(subtaskStartIdx).map(async (task) => {
      try {
        const res = await fetch(assignUrl, {
          method: 'POST',
          headers: assignHeaders,
          body: JSON.stringify({ task_id: task.id }),
        });
        const data = await res.json();
        return {
          task_id: task.id,
          title: task.title,
          owner: data.owner || null,
          owner_name: data.owner_name || null,
          assignments: data.assignments || [],
        };
      } catch {
        return { task_id: task.id, title: task.title, owner: null, owner_name: null, assignments: [] };
      }
    });

    const assignResults = await Promise.all(assignPromises);
    results.push(...assignResults);

    // Update plan status + inbox notification in parallel
    const fromAgent = omega?.id || 'omega';
    await Promise.all([
      supabase.from('plans').update({ status: 'executing' }).eq('id', plan_id),
      supabase.from('inbox').insert({
        from_agent: fromAgent,
        message: `Omega received your plan "${plan.title}" and distributed ${results.length} tasks across the team.`,
        type: 'plan_decompose',
      }),
    ]);

    return new Response(JSON.stringify({ ok: true, subtasks: results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
