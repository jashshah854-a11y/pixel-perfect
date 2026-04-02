import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const actions: Array<{ action_type: string; description: string; agent_id?: string; task_id?: string }> = [];

    // 1. Check for unassigned queued tasks
    const { data: queuedTasks } = await supabase.from('tasks')
      .select('*')
      .eq('status', 'queued')
      .is('assigned_to', null)
      .limit(3);

    const { data: agents } = await supabase.from('agents').select('*');
    const idleAgents = (agents || []).filter(a => a.status === 'idle');

    // Auto-assign unassigned tasks
    for (const task of (queuedTasks || []).slice(0, 3)) {
      // Call assign-task for each
      const assignUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/assign-task`;
      try {
        const res = await fetch(assignUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
          },
          body: JSON.stringify({ task_id: task.id }),
        });
        const result = await res.json();
        actions.push({
          action_type: 'auto_assign',
          description: `Auto-assigned "${task.title}" to ${result.owner_name || 'best fit agent'}`,
          agent_id: result.owner || undefined,
          task_id: task.id,
        });
      } catch (e) {
        actions.push({
          action_type: 'auto_assign_failed',
          description: `Failed to auto-assign "${task.title}": ${e.message}`,
          task_id: task.id,
        });
      }
    }

    // 2. Check for overloaded agents and dispatch Hivemind
    const { data: assignments } = await supabase.from('task_assignments')
      .select('agent_id, role')
      .eq('role', 'owner');

    const ownerCounts: Record<string, number> = {};
    for (const a of (assignments || [])) {
      ownerCounts[a.agent_id] = (ownerCounts[a.agent_id] || 0) + 1;
    }

    const overloaded = (agents || []).filter(a => (ownerCounts[a.id] || 0) > 3 && a.id !== 'hivemind');
    if (overloaded.length > 0) {
      actions.push({
        action_type: 'hivemind_dispatch',
        description: `Hivemind support requested for ${overloaded.map(a => a.name).join(', ')} (overloaded)`,
        agent_id: 'hivemind',
      });
    }

    // 3. Check for stale in_progress tasks (no update in a while)
    const { data: staleTasks } = await supabase.from('tasks')
      .select('*')
      .eq('status', 'in_progress')
      .lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .limit(3);

    for (const task of (staleTasks || [])) {
      actions.push({
        action_type: 'stale_warning',
        description: `Task "${task.title}" has been in progress for over 24h — may need attention`,
        task_id: task.id,
        agent_id: task.assigned_to || undefined,
      });
    }

    // Log all actions
    if (actions.length > 0) {
      await supabase.from('autonomous_actions').insert(
        actions.map(a => ({
          action_type: a.action_type,
          description: a.description,
          agent_id: a.agent_id || null,
          task_id: a.task_id || null,
          approved: true, // auto-approved within guardrails
        }))
      );
    }

    return new Response(JSON.stringify({ ok: true, actions_taken: actions.length, actions }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error("autonomous-tick error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
