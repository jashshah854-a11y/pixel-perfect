import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Role-specific learning prompts
const ROLE_CONTEXT: Record<string, string> = {
  orchestration: "project coordination, workflow management, team routing, task prioritization",
  architecture: "system design, infrastructure decisions, scalability patterns, schema design",
  "ui/ux": "interface design, component patterns, user experience, visual consistency",
  frontend: "interface design, component patterns, user experience, visual consistency",
  research: "data analysis, research methodology, insight extraction, pattern recognition",
  intelligence: "data analysis, research methodology, insight extraction, pattern recognition",
  security: "security practices, access control, vulnerability assessment, compliance",
  review: "code quality, testing patterns, bug detection, quality assurance",
  qa: "code quality, testing patterns, bug detection, quality assurance",
  backend: "API design, database optimization, server architecture, deployment",
  devops: "deployment, infrastructure, CI/CD, monitoring, server management",
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { task_id } = await req.json();
    if (!task_id) throw new Error("task_id required");

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Load completed task with assignment history
    const [taskRes, assignmentsRes, agentsRes] = await Promise.all([
      supabase.from('tasks').select('*').eq('id', task_id).single(),
      supabase.from('task_assignments').select('*').eq('task_id', task_id),
      supabase.from('agents').select('*'),
    ]);

    if (!taskRes.data) throw new Error("Task not found");
    const task = taskRes.data;
    const assignments = assignmentsRes.data || [];
    const agents = agentsRes.data || [];
    const agentMap = Object.fromEntries(agents.map(a => [a.id, a]));

    // Load existing memory to avoid duplicates
    const { data: existingMemory } = await supabase
      .from('agent_memory')
      .select('content')
      .eq('source_task_id', task_id);
    
    if (existingMemory && existingMemory.length > 0) {
      return new Response(JSON.stringify({ ok: true, message: "Already learned from this task" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const memories: Array<{
      agent_id: string;
      memory_type: string;
      content: string;
      source_task_id: string;
      confidence: number;
      tags: string[];
    }> = [];

    // Use Lovable AI to extract learnings
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (LOVABLE_API_KEY) {
      // For each involved agent, extract role-specific learnings
      const involvedAgents = assignments
        .filter(a => a.role === 'owner' || a.role === 'support')
        .map(a => ({ ...a, agent: agentMap[a.agent_id] }))
        .filter(a => a.agent);

      for (const assignment of involvedAgents) {
        const agent = assignment.agent;
        const dept = agent.department.toLowerCase();
        const roleContext = ROLE_CONTEXT[dept] || "general software development";

        const prompt = `Analyze this completed task and extract 1-3 specific, actionable learnings for an AI agent specializing in ${roleContext}.

Task: "${task.title}"
Description: "${task.description || 'No description'}"
Priority: ${task.priority}
Agent Role: ${agent.role} (${agent.department})
Fit Score: ${assignment.fit_score}/100
Assignment Role: ${assignment.role}

Extract learnings in these categories:
- "pattern": A recurring work pattern or approach that worked
- "preference": A user preference or standard observed
- "correction": Something to avoid or do differently next time

Return a JSON array of objects with: type, content, confidence (0-1), tags (string array)
Only include genuinely useful learnings, not generic statements.`;

        try {
          const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              messages: [
                { role: "system", content: "You extract structured learnings from task data. Return valid JSON arrays only. Be specific and actionable, not generic." },
                { role: "user", content: prompt },
              ],
              tools: [{
                type: "function",
                function: {
                  name: "store_learnings",
                  description: "Store extracted learnings from a completed task",
                  parameters: {
                    type: "object",
                    properties: {
                      learnings: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            type: { type: "string", enum: ["pattern", "preference", "correction"] },
                            content: { type: "string" },
                            confidence: { type: "number" },
                            tags: { type: "array", items: { type: "string" } }
                          },
                          required: ["type", "content", "confidence", "tags"]
                        }
                      }
                    },
                    required: ["learnings"]
                  }
                }
              }],
              tool_choice: { type: "function", function: { name: "store_learnings" } },
            }),
          });

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
            if (toolCall?.function?.arguments) {
              const parsed = JSON.parse(toolCall.function.arguments);
              for (const learning of (parsed.learnings || [])) {
                if (learning.confidence >= 0.3) {
                  memories.push({
                    agent_id: agent.id,
                    memory_type: learning.type,
                    content: learning.content,
                    source_task_id: task_id,
                    confidence: Math.min(1, Math.max(0, learning.confidence)),
                    tags: learning.tags || [],
                  });
                }
              }
            }
          }
        } catch (aiErr) {
          console.error("AI extraction failed for agent", agent.name, aiErr);
          // Fallback: simple heuristic learning
          memories.push({
            agent_id: agent.id,
            memory_type: 'pattern',
            content: `Successfully handled "${task.title}" (${task.priority} priority) as ${assignment.role} with fit score ${assignment.fit_score}`,
            source_task_id: task_id,
            confidence: assignment.fit_score / 100,
            tags: [task.priority, assignment.role, agent.department.toLowerCase()],
          });
        }
      }
    } else {
      // No AI key — use heuristic learning
      for (const assignment of assignments.filter(a => a.role !== 'observer')) {
        const agent = agentMap[assignment.agent_id];
        if (!agent) continue;
        memories.push({
          agent_id: agent.id,
          memory_type: 'pattern',
          content: `Handled "${task.title}" as ${assignment.role}. Priority: ${task.priority}. Fit: ${assignment.fit_score}/100.`,
          source_task_id: task_id,
          confidence: assignment.fit_score / 100,
          tags: [task.priority, assignment.role],
        });
      }
    }

    // Store memories
    if (memories.length > 0) {
      await supabase.from('agent_memory').insert(memories);
    }

    // Also create collaboration records if multiple agents were involved
    const owners = assignments.filter(a => a.role === 'owner');
    const supporters = assignments.filter(a => a.role === 'support');
    
    if (owners.length > 0 && supporters.length > 0) {
      const collabs = supporters.map(s => ({
        task_id,
        from_agent: s.agent_id,
        to_agent: owners[0].agent_id,
        collab_type: 'share_finding',
        message: `Supported on "${task.title}" with fit score ${s.fit_score}`,
        status: 'completed',
        resolved_at: new Date().toISOString(),
      }));
      await supabase.from('agent_collaborations').insert(collabs);
    }

    return new Response(JSON.stringify({ 
      ok: true, 
      memories_created: memories.length,
      agents_learned: [...new Set(memories.map(m => m.agent_id))].length,
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
