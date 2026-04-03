import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MIN_OUTPUT_LINES = 10;
const MIN_OUTPUT_CHARS = 200;
const MAX_TASKS_PER_TICK = 3;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const BASE = Deno.env.get('SUPABASE_URL')!;
    const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${KEY}` };

    const actions: Array<{ action_type: string; description: string; agent_id?: string; task_id?: string }> = [];

    // ===== PHASE 1: Assign unassigned queued tasks =====
    const { data: unassigned } = await supabase.from('tasks')
      .select('id, title')
      .eq('status', 'queued')
      .is('assigned_to', null)
      .limit(MAX_TASKS_PER_TICK);

    for (const task of (unassigned || [])) {
      try {
        const res = await fetch(`${BASE}/functions/v1/assign-task`, {
          method: 'POST', headers,
          body: JSON.stringify({ task_id: task.id }),
        });
        const result = await res.json();
        actions.push({
          action_type: 'assign',
          description: `Assigned "${task.title}" → ${result.owner_name || 'agent'}`,
          agent_id: result.owner || undefined,
          task_id: task.id,
        });
      } catch (e) {
        actions.push({ action_type: 'assign_failed', description: `Assign failed: ${task.title}`, task_id: task.id });
      }
    }

    // ===== PHASE 2: Execute assigned tasks (queued with owner, or in_progress) =====
    const { data: executableTasks } = await supabase.from('tasks')
      .select('id, title, assigned_to, status, description')
      .in('status', ['queued', 'in_progress'])
      .not('assigned_to', 'is', null)
      .limit(MAX_TASKS_PER_TICK);

    // Check which tasks already have outputs (don't re-execute)
    const taskIds = (executableTasks || []).map(t => t.id);
    const { data: existingOutputs } = taskIds.length > 0
      ? await supabase.from('task_outputs').select('task_id').in('task_id', taskIds)
      : { data: [] };
    const hasOutput = new Set((existingOutputs || []).map(o => o.task_id));

    for (const task of (executableTasks || [])) {
      if (hasOutput.has(task.id)) continue; // Already executed

      // Move to in_progress if queued
      if (task.status === 'queued') {
        await supabase.from('tasks').update({ status: 'in_progress' }).eq('id', task.id);
        await supabase.from('agents').update({ status: 'working', current_task: task.title }).eq('id', task.assigned_to);
      }

      // Check if task needs research first
      const taskText = `${task.title} ${task.description || ''}`.toLowerCase();
      if (taskText.match(/research|analyze|compare|evaluate|benchmark|optimize|investigate/)) {
        try {
          const researchRes = await fetch(`${BASE}/functions/v1/agent-research`, {
            method: 'POST', headers,
            body: JSON.stringify({
              agent_id: task.assigned_to,
              topic: task.title,
              task_id: task.id,
              use_exa: true,
            }),
          });
          await researchRes.json();
          actions.push({
            action_type: 'research',
            description: `Research triggered for "${task.title}"`,
            agent_id: task.assigned_to!,
            task_id: task.id,
          });
        } catch { /* best effort */ }
      }

      // Execute the task
      try {
        const execRes = await fetch(`${BASE}/functions/v1/agent-execute`, {
          method: 'POST', headers,
          body: JSON.stringify({ task_id: task.id }),
        });
        const execResult = await execRes.json();

        if (execResult.ok) {
          // ===== PHASE 3: Validate output quality =====
          const { data: outputs } = await supabase.from('task_outputs')
            .select('content, output_type')
            .eq('task_id', task.id)
            .eq('output_type', 'code');

          const codeOutput = outputs?.[0];
          const lines = codeOutput?.content?.split('\n').length || 0;
          const chars = codeOutput?.content?.length || 0;

          if (lines < MIN_OUTPUT_LINES || chars < MIN_OUTPUT_CHARS) {
            // Output too shallow — mark as needs_review, don't complete
            await supabase.from('tasks').update({ status: 'in_progress' }).eq('id', task.id);
            actions.push({
              action_type: 'validation_failed',
              description: `"${task.title}" output too shallow (${lines} lines, ${chars} chars). Needs deeper execution.`,
              task_id: task.id,
              agent_id: task.assigned_to!,
            });

            // Notify about shallow output
            await fetch(`${BASE}/functions/v1/notify-event`, {
              method: 'POST', headers,
              body: JSON.stringify({
                event_type: 'workflow_blocker',
                payload: {
                  task_id: task.id,
                  task_title: task.title,
                  blocker_reason: `Output validation failed: ${lines} lines (min ${MIN_OUTPUT_LINES}), ${chars} chars (min ${MIN_OUTPUT_CHARS})`,
                  agent_id: task.assigned_to,
                  agent_name: task.assigned_to,
                },
              }),
            });
            continue;
          }

          // ===== PHASE 4: Learn from execution =====
          try {
            const learnRes = await fetch(`${BASE}/functions/v1/agent-learn`, {
              method: 'POST', headers,
              body: JSON.stringify({ task_id: task.id }),
            });
            await learnRes.json();
          } catch { /* best effort */ }

          // ===== PHASE 5: Mark complete =====
          await supabase.from('tasks').update({
            status: 'done',
            completed_at: new Date().toISOString(),
          }).eq('id', task.id);

          await supabase.from('agents').update({
            status: 'idle',
            current_task: null,
          }).eq('id', task.assigned_to);

          actions.push({
            action_type: 'completed',
            description: `"${task.title}" executed, validated (${lines} lines), learned, and completed`,
            agent_id: task.assigned_to!,
            task_id: task.id,
          });

          // ===== PHASE 6: Trigger dependent tasks =====
          // Find tasks from same source/plan that are still queued
          if (task.assigned_to) {
            const { data: planTasks } = await supabase.from('tasks')
              .select('id, title, status')
              .eq('source', 'plan')
              .eq('status', 'queued')
              .limit(2);

            for (const depTask of (planTasks || [])) {
              // Pass context from completed task to dependent task
              const { data: completedOutputs } = await supabase.from('task_outputs')
                .select('content, output_type, title')
                .eq('task_id', task.id);

              const contextSummary = (completedOutputs || [])
                .map(o => `[${o.output_type}] ${o.title}: ${o.content.slice(0, 200)}`)
                .join('\n');

              // Update dependent task description with predecessor context
              if (contextSummary) {
                const existingDesc = depTask.title;
                await supabase.from('tasks').update({
                  description: `${existingDesc}\n\n--- Context from completed "${task.title}" ---\n${contextSummary}`,
                }).eq('id', depTask.id);
              }

              // Create collaboration record for the handoff
              await supabase.from('agent_collaborations').insert({
                from_agent: task.assigned_to,
                to_agent: depTask.id, // will be overwritten on assign
                collab_type: 'task_handoff',
                message: `Completed "${task.title}" → unblocking "${depTask.title}" with ${(completedOutputs || []).length} artifacts`,
                status: 'completed',
                task_id: depTask.id,
                resolved_at: new Date().toISOString(),
              });

              actions.push({
                action_type: 'dependency_trigger',
                description: `"${task.title}" completed → unblocked "${depTask.title}" with context`,
                task_id: depTask.id,
              });
            }
          }

          // Notify completion
          try {
            await fetch(`${BASE}/functions/v1/notify-event`, {
              method: 'POST', headers,
              body: JSON.stringify({
                event_type: 'task_completed',
                payload: {
                  task_id: task.id,
                  task_title: task.title,
                  agent_id: task.assigned_to,
                  agent_name: task.assigned_to,
                },
              }),
            });
          } catch { /* best effort */ }
        }
      } catch (e) {
        actions.push({
          action_type: 'execute_failed',
          description: `Execution failed for "${task.title}": ${e.message}`,
          task_id: task.id,
        });
      }
    }

    // ===== PHASE 7: Stale task detection =====
    const { data: staleTasks } = await supabase.from('tasks')
      .select('id, title, assigned_to')
      .eq('status', 'in_progress')
      .lt('created_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
      .limit(3);

    for (const task of (staleTasks || [])) {
      // Check if it has outputs already
      const { data: outputs } = await supabase.from('task_outputs')
        .select('id').eq('task_id', task.id).limit(1);
      
      if (outputs && outputs.length > 0) {
        // Has output but stuck in_progress — force complete
        await supabase.from('tasks').update({
          status: 'done',
          completed_at: new Date().toISOString(),
        }).eq('id', task.id);

        if (task.assigned_to) {
          await supabase.from('agents').update({ status: 'idle', current_task: null }).eq('id', task.assigned_to);
        }

        actions.push({
          action_type: 'stale_resolved',
          description: `Stale task "${task.title}" had outputs — auto-completed`,
          task_id: task.id,
        });
      } else {
        actions.push({
          action_type: 'stale_warning',
          description: `Task "${task.title}" stuck in_progress 2h+ with no output`,
          task_id: task.id,
          agent_id: task.assigned_to || undefined,
        });
      }
    }

    // Log all actions
    if (actions.length > 0) {
      await supabase.from('autonomous_actions').insert(
        actions.map(a => ({
          action_type: a.action_type,
          description: a.description,
          agent_id: a.agent_id || null,
          task_id: a.task_id || null,
          approved: true,
        }))
      );
    }

    return new Response(JSON.stringify({
      ok: true,
      actions_taken: actions.length,
      actions,
      phases: {
        assigned: actions.filter(a => a.action_type === 'assign').length,
        executed: actions.filter(a => a.action_type === 'completed').length,
        validation_failed: actions.filter(a => a.action_type === 'validation_failed').length,
        deps_triggered: actions.filter(a => a.action_type === 'dependency_trigger').length,
        stale_resolved: actions.filter(a => a.action_type === 'stale_resolved').length,
      },
    }), {
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
