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

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Gather system state
    const [tasksRes, agentsRes, memoriesRes, assignmentsRes, collabsRes] = await Promise.all([
      supabase.from('tasks').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('agents').select('*'),
      supabase.from('agent_memory').select('agent_id, content, confidence, tags, memory_type').order('created_at', { ascending: false }).limit(100),
      supabase.from('task_assignments').select('agent_id, role, fit_score, task_id').order('claimed_at', { ascending: false }).limit(100),
      supabase.from('agent_collaborations').select('*').order('created_at', { ascending: false }).limit(30),
    ]);

    const tasks = tasksRes.data || [];
    const agents = agentsRes.data || [];
    const memories = memoriesRes.data || [];
    const assignments = assignmentsRes.data || [];
    const collabs = collabsRes.data || [];

    const activeTasks = tasks.filter(t => t.status === 'in_progress');
    const blockedTasks = tasks.filter(t => t.status === 'blocked');
    const queuedTasks = tasks.filter(t => t.status === 'queued');
    const doneTasks = tasks.filter(t => t.status === 'done');
    const idleAgents = agents.filter(a => a.status === 'idle');
    const workingAgents = agents.filter(a => a.status === 'working');

    // Count tasks per agent
    const ownerCounts: Record<string, number> = {};
    for (const a of assignments.filter(a => a.role === 'owner')) {
      ownerCounts[a.agent_id] = (ownerCounts[a.agent_id] || 0) + 1;
    }

    const systemState = `
SYSTEM STATE SNAPSHOT:
- ${activeTasks.length} active tasks, ${blockedTasks.length} blocked, ${queuedTasks.length} queued, ${doneTasks.length} completed
- ${workingAgents.length}/${agents.length} agents working, ${idleAgents.length} idle
- Agents: ${agents.map(a => `${a.name} (${a.department}, ${a.status}, ${ownerCounts[a.id] || 0} owned tasks)`).join('; ')}
- Recent tasks: ${tasks.slice(0, 10).map(t => `"${t.title}" [${t.status}/${t.priority}]`).join('; ')}
- Blocked tasks: ${blockedTasks.map(t => `"${t.title}" assigned to ${t.assigned_to || 'none'}`).join('; ') || 'none'}
- Active collaborations: ${collabs.filter(c => c.status === 'pending' || c.status === 'in_progress').length}
- Total memories: ${memories.length}, avg confidence: ${memories.length > 0 ? (memories.reduce((s, m) => s + m.confidence, 0) / memories.length).toFixed(2) : '0'}
`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: "You are a predictive intelligence system for an AI agent office. Analyze the system state and generate 3-5 actionable suggestions. Each suggestion must be grounded in the actual data provided. Be specific about agent names and task details."
          },
          { role: "user", content: systemState }
        ],
        tools: [{
          type: "function",
          function: {
            name: "provide_suggestions",
            description: "Return actionable system suggestions",
            parameters: {
              type: "object",
              properties: {
                suggestions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      type: { type: "string", enum: ["next_task", "optimization", "reassignment", "risk", "efficiency"] },
                      title: { type: "string" },
                      description: { type: "string" },
                      confidence: { type: "number" },
                      affected_agents: { type: "array", items: { type: "string" } }
                    },
                    required: ["type", "title", "description", "confidence", "affected_agents"],
                    additionalProperties: false
                  }
                }
              },
              required: ["suggestions"],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "provide_suggestions" } }
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, try again later" }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      throw new Error(`AI error: ${response.status}`);
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    
    let suggestions: any[] = [];
    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      suggestions = parsed.suggestions || [];
    }

    // Persist suggestions
    if (suggestions.length > 0) {
      await supabase.from('system_suggestions').insert(
        suggestions.map((s: any) => ({
          type: s.type,
          title: s.title,
          description: s.description,
          confidence: s.confidence,
          affected_agents: s.affected_agents,
          status: 'pending',
        }))
      );
    }

    return new Response(JSON.stringify({ ok: true, suggestions }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error("generate-suggestions error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
