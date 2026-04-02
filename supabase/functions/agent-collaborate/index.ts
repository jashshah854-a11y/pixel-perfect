import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { from_agent, to_agent, task_id, collab_type, message } = await req.json();
    if (!from_agent || !to_agent || !message) {
      throw new Error("from_agent, to_agent, and message are required");
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Create collaboration record
    const { data: collab, error: collabErr } = await supabase
      .from('agent_collaborations')
      .insert({
        from_agent,
        to_agent,
        task_id: task_id || null,
        collab_type: collab_type || 'share_finding',
        message,
        status: 'pending',
      })
      .select()
      .single();

    if (collabErr) throw collabErr;

    // Load agent names for notification
    const { data: agents } = await supabase.from('agents').select('id, name');
    const agentMap = Object.fromEntries((agents || []).map(a => [a.id, a.name]));

    const fromName = agentMap[from_agent] || from_agent;
    const toName = agentMap[to_agent] || to_agent;

    // Notify receiving agent via inbox
    const typeLabels: Record<string, string> = {
      handoff: "🔄 Handoff",
      request_help: "🆘 Help Request",
      share_finding: "💡 Shared Finding",
      review: "🔍 Review Request",
    };

    await supabase.from('inbox').insert({
      from_agent,
      to_agent,
      message: `${typeLabels[collab_type] || "📋 Collaboration"} from ${fromName}: ${message}`,
      type: 'collaboration',
    });

    // If it's a handoff, update task assignment
    if (collab_type === 'handoff' && task_id) {
      await supabase.from('tasks').update({ assigned_to: to_agent }).eq('id', task_id);
      
      // Update agent statuses
      await supabase.from('agents').update({ 
        status: 'working', 
        current_task: message,
        last_active: new Date().toISOString() 
      }).eq('id', to_agent);
    }

    return new Response(JSON.stringify({ ok: true, collaboration: collab }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
