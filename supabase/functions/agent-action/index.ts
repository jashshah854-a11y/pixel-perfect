import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { action_type, agent_id, task_id, target, payload } = await req.json();
    if (!action_type || !agent_id) throw new Error("action_type and agent_id required");

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    let result: any = null;
    let status = 'completed';

    switch (action_type) {
      case 'webhook': {
        if (!target) throw new Error("target URL required for webhook");
        try {
          const res = await fetch(target, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload || {}),
          });
          result = { status: res.status, ok: res.ok };
          status = res.ok ? 'completed' : 'failed';
        } catch (e) {
          result = { error: e.message };
          status = 'failed';
        }
        break;
      }

      case 'document_log': {
        // Store structured notes in agent_memory
        await supabase.from('agent_memory').insert({
          agent_id,
          content: payload?.content || 'Document log entry',
          memory_type: 'document',
          confidence: 0.8,
          source_task_id: task_id || null,
          tags: payload?.tags || ['document', 'external'],
        });
        result = { logged: true };
        break;
      }

      case 'notification': {
        // Create inbox notification
        await supabase.from('inbox').insert({
          from_agent: agent_id,
          message: payload?.message || 'External action completed',
          type: 'external_action',
        });
        result = { notified: true };
        break;
      }

      default:
        throw new Error(`Unknown action_type: ${action_type}`);
    }

    // Log the action
    await supabase.from('external_actions').insert({
      agent_id,
      task_id: task_id || null,
      action_type,
      target: target || null,
      payload: payload || {},
      result,
      status,
    });

    return new Response(JSON.stringify({ ok: true, status, result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error("agent-action error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
