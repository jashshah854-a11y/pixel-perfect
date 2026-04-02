import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple rule-based subtask extraction from plan content
function extractSubtasks(title: string, content: string): { title: string; description: string; keywords: string[] }[] {
  const text = `${title} ${content}`.toLowerCase();
  const subtasks: { title: string; description: string; keywords: string[] }[] = [];

  // Parse markdown headers/bullets as potential subtasks
  const lines = content.split('\n').filter(l => l.trim());
  const bulletItems: string[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    // Match markdown headers (## or ###)
    const headerMatch = trimmed.match(/^#{2,3}\s+(.+)/);
    if (headerMatch) {
      bulletItems.push(headerMatch[1]);
      continue;
    }
    // Match bullet points
    const bulletMatch = trimmed.match(/^[-*]\s+(.+)/);
    if (bulletMatch) {
      bulletItems.push(bulletMatch[1]);
      continue;
    }
    // Match numbered items
    const numMatch = trimmed.match(/^\d+[.)]\s+(.+)/);
    if (numMatch) {
      bulletItems.push(numMatch[1]);
    }
  }

  // If plan has structured items, use them
  if (bulletItems.length > 0) {
    for (const item of bulletItems.slice(0, 8)) {
      subtasks.push({
        title: item.slice(0, 100),
        description: `Subtask from plan: ${title}`,
        keywords: item.toLowerCase().split(/\s+/).filter(w => w.length > 3),
      });
    }
  }

  // If no structured items found, generate role-based subtasks from the plan title/content
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

    // Always add coordination + QA if we have other subtasks
    if (subtasks.length > 0 && subtasks.length < 6) {
      if (!subtasks.some(s => s.keywords.includes("coordinate"))) {
        subtasks.unshift({ title: `Coordinate: ${title}`, description: `Orchestration for plan: ${title}`, keywords: ["coordinate", "plan", "manage"] });
      }
      if (!subtasks.some(s => s.keywords.includes("test"))) {
        subtasks.push({ title: `QA validation: ${title}`, description: `Quality assurance for plan: ${title}`, keywords: ["test", "quality", "verify"] });
      }
    }

    // Fallback: generate basic decomposition
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

    // Load plan
    const { data: plan, error: planErr } = await supabase
      .from('plans')
      .select('*')
      .eq('id', plan_id)
      .single();

    if (planErr || !plan) throw new Error("Plan not found");

    // Extract subtasks
    const subtasks = extractSubtasks(plan.title, plan.markdown_content || "");

    // Create tasks and assign each
    const results = [];
    for (const sub of subtasks) {
      const { data: task, error: taskErr } = await supabase
        .from('tasks')
        .insert({
          title: sub.title,
          description: sub.description,
          priority: 'medium',
          status: 'queued',
          source: 'plan',
        })
        .select('id')
        .single();

      if (taskErr || !task) continue;

      // Call assign-task for each subtask
      const assignUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/assign-task`;
      const assignRes = await fetch(assignUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({ task_id: task.id }),
      });

      const assignData = await assignRes.json();
      results.push({
        task_id: task.id,
        title: sub.title,
        owner: assignData.owner || null,
        assignments: assignData.assignments || [],
      });
    }

    // Update plan status to executing
    await supabase.from('plans').update({ status: 'executing' }).eq('id', plan_id);

    // Inbox notification
    await supabase.from('inbox').insert({
      from_agent: 'hivemind',
      message: `Plan "${plan.title}" decomposed into ${results.length} subtasks and assigned across the team.`,
      type: 'plan_decompose',
    });

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
