import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Smart notification engine — creates inbox items from system events.
 * 
 * Events: task_completed, agent_collaboration, sub_agent_spawn,
 *         research_suggestion, workflow_blocker, task_state_change,
 *         plan_created, escalation
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const { event_type, payload } = body;

    if (!event_type) throw new Error("event_type required");

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const inboxItems: any[] = [];

    switch (event_type) {
      case "task_completed": {
        const { task_id, task_title, agent_id, agent_name } = payload;
        inboxItems.push({
          from_agent: agent_id || null,
          message: `Task completed: "${task_title || 'Untitled'}"${agent_name ? ` by ${agent_name}` : ''}`,
          type: 'update',
          metadata: {
            event_type: 'task_completed',
            task_id,
            reasoning: `${agent_name || 'Agent'} finished execution of the assigned task.`,
            impact: 'Task output is now available for review or downstream use.',
            next_steps: ['Review task output', 'Check dependent tasks', 'Mark related work as unblocked'],
            actions: [
              { label: 'View Output', type: 'open_review', payload: { task_id } },
              { label: 'Create Follow-up', type: 'create_task', payload: { title: `Follow-up: ${task_title}` } },
            ],
          },
        });
        break;
      }

      case "agent_collaboration": {
        const { from_agent, to_agent, from_name, to_name, message, collab_type, task_id } = payload;
        inboxItems.push({
          from_agent: from_agent || null,
          message: `${from_name || 'Agent'} → ${to_name || 'Agent'}: ${message || `${collab_type || 'collaboration'} initiated`}`,
          type: 'update',
          metadata: {
            event_type: 'agent_collaboration',
            task_id,
            reasoning: `Cross-agent collaboration triggered to combine specialized capabilities.`,
            impact: `${from_name} and ${to_name} are now working together on shared objective.`,
            next_steps: ['Monitor collaboration progress', 'Check for shared outputs'],
          },
        });
        break;
      }

      case "sub_agent_spawn": {
        const { parent_name, sub_agent_name, reason, delegated_tasks } = payload;
        inboxItems.push({
          from_agent: payload.parent_id || null,
          message: `${parent_name} spawned sub-agent "${sub_agent_name}" for parallel execution`,
          type: 'alert',
          metadata: {
            event_type: 'sub_agent_spawn',
            reasoning: reason || 'Workload exceeded agent capacity threshold.',
            impact: `${(delegated_tasks || []).length} tasks delegated to sub-agent for faster execution.`,
            next_steps: delegated_tasks || [],
            actions: [{ label: 'View Delegation', type: 'open_review' }],
          },
        });
        break;
      }

      case "research_suggestion": {
        const { agent_id, agent_name, topic, findings, source_url } = payload;
        inboxItems.push({
          from_agent: agent_id || null,
          message: `${agent_name || 'Oracle'} completed research: ${topic}`,
          type: 'recommendation',
          metadata: {
            event_type: 'research_suggestion',
            reasoning: findings || 'External research completed to improve execution quality.',
            impact: 'New intelligence available that may optimize current workflows.',
            next_steps: ['Review findings', 'Apply recommendations to active tasks'],
            links: source_url ? [{ label: 'Source', url: source_url }] : [],
            actions: [
              { label: 'Apply Findings', type: 'apply_change' },
              { label: 'Create Research Task', type: 'create_task', payload: { title: `Deep dive: ${topic}` } },
            ],
          },
        });
        break;
      }

      case "workflow_blocker": {
        const { task_id, task_title, blocker_reason, agent_name } = payload;
        inboxItems.push({
          from_agent: payload.agent_id || null,
          message: `⚠️ Blocker detected: ${blocker_reason || `Task "${task_title}" is blocked`}`,
          type: 'alert',
          metadata: {
            event_type: 'workflow_blocker',
            task_id,
            reasoning: blocker_reason || 'A dependency or resource constraint is preventing task progress.',
            impact: 'Downstream tasks may be delayed until this blocker is resolved.',
            next_steps: ['Investigate blocker cause', 'Reassign or unblock the task', 'Check dependent tasks'],
            actions: [
              { label: 'Reassign Work', type: 'reassign' },
              { label: 'Create Unblock Task', type: 'create_task', payload: { title: `Unblock: ${task_title}`, priority: 'high' } },
            ],
          },
        });
        break;
      }

      case "task_state_change": {
        const { task_id, task_title, old_status, new_status, agent_name } = payload;
        // Only notify on significant transitions
        if (['in_progress', 'blocked', 'done'].includes(new_status)) {
          inboxItems.push({
            from_agent: payload.agent_id || null,
            message: `${agent_name || 'System'}: "${task_title}" moved from ${old_status} → ${new_status}`,
            type: 'update',
            metadata: {
              event_type: 'task_state_change',
              task_id,
              reasoning: `Task lifecycle transition from ${old_status} to ${new_status}.`,
              impact: new_status === 'blocked' ? 'Task is blocked — may affect downstream work.' : 'Normal workflow progression.',
              next_steps: new_status === 'done' ? ['Review output', 'Unblock dependent tasks'] : [],
            },
          });
        }
        break;
      }

      case "escalation": {
        const { agent_name, reason, action } = payload;
        inboxItems.push({
          from_agent: payload.agent_id || null,
          message: `🔺 Escalation from ${agent_name}: ${reason}`,
          type: 'alert',
          metadata: {
            event_type: 'escalation',
            reasoning: reason,
            impact: 'Agent capacity or capability gap detected.',
            next_steps: [action || 'Review and reassign work'],
            actions: [
              { label: 'Rebalance', type: 'reassign' },
              { label: 'Acknowledge', type: 'acknowledge' },
            ],
          },
        });
        break;
      }

      default: {
        inboxItems.push({
          message: `System event: ${event_type} — ${JSON.stringify(payload).slice(0, 200)}`,
          type: 'update',
          metadata: { event_type, ...payload },
        });
      }
    }

    if (inboxItems.length > 0) {
      const { error } = await supabase.from('inbox').insert(inboxItems);
      if (error) throw error;
    }

    return new Response(JSON.stringify({ ok: true, created: inboxItems.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
