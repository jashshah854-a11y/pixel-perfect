import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ROLE_CONTEXT: Record<string, string> = {
  orchestration: "project coordination, workflow management, team routing",
  architecture: "system design, infrastructure, scalability, schema design",
  "ui/ux": "interface design, component patterns, user experience",
  frontend: "interface design, component patterns, user experience",
  research: "data analysis, research methodology, insight extraction",
  intelligence: "data analysis, research methodology, insight extraction",
  security: "security practices, access control, vulnerability assessment",
  review: "code quality, testing patterns, bug detection",
  qa: "code quality, testing patterns, bug detection",
  backend: "API design, database optimization, server architecture",
  devops: "deployment, infrastructure, CI/CD, monitoring",
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

    // Load everything in one parallel batch (including duplicate check)
    const [taskRes, assignmentsRes, agentsRes, existingRes] = await Promise.all([
      supabase.from('tasks').select('*').eq('id', task_id).single(),
      supabase.from('task_assignments').select('agent_id, role, fit_score').eq('task_id', task_id),
      supabase.from('agents').select('id, name, department, role'),
      supabase.from('agent_memory').select('id').eq('source_task_id', task_id).limit(1),
    ]);

    if (!taskRes.data) throw new Error("Task not found");

    // Early exit if already learned
    if (existingRes.data && existingRes.data.length > 0) {
      return new Response(JSON.stringify({ ok: true, message: "Already learned from this task" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const task = taskRes.data;
    const assignments = assignmentsRes.data || [];
    const agentMap = Object.fromEntries((agentsRes.data || []).map((a: any) => [a.id, a]));

    const involvedAgents = assignments
      .filter(a => a.role === 'owner' || a.role === 'support')
      .map(a => ({ ...a, agent: agentMap[a.agent_id] }))
      .filter(a => a.agent);

    const memories: Array<{
      agent_id: string;
      memory_type: string;
      content: string;
      source_task_id: string;
      confidence: number;
      tags: string[];
    }> = [];

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (LOVABLE_API_KEY && involvedAgents.length > 0) {
      // Parallel AI calls for all agents at once
      const aiPromises = involvedAgents.map(async (assignment) => {
        const agent = assignment.agent;
        const dept = agent.department.toLowerCase();
        const roleContext = ROLE_CONTEXT[dept] || "general software development";

        const prompt = `Extract 1-2 specific learnings for an AI agent in ${roleContext}.
Task: "${task.title}" | Desc: "${task.description || 'None'}" | Priority: ${task.priority} | Role: ${assignment.role} | Fit: ${assignment.fit_score}/100
Return JSON array: [{type:"pattern"|"preference"|"correction", content:string, confidence:0-1, tags:string[]}]`;

        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 4000);

          const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            signal: controller.signal,
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              messages: [
                { role: "system", content: "Extract structured learnings. Return valid JSON arrays only. Be specific." },
                { role: "user", content: prompt },
              ],
              tools: [{
                type: "function",
                function: {
                  name: "store_learnings",
                  description: "Store learnings",
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

          clearTimeout(timeout);

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
            if (toolCall?.function?.arguments) {
              const parsed = JSON.parse(toolCall.function.arguments);
              return (parsed.learnings || [])
                .filter((l: any) => l.confidence >= 0.3)
                .map((l: any) => ({
                  agent_id: agent.id,
                  memory_type: l.type,
                  content: l.content,
                  source_task_id: task_id,
                  confidence: Math.min(1, Math.max(0, l.confidence)),
                  tags: l.tags || [],
                }));
            }
          } else {
            await aiResponse.text(); // consume body
          }
        } catch {
          // Fallback on timeout/error
        }

        // Heuristic fallback
        return [{
          agent_id: agent.id,
          memory_type: 'pattern',
          content: `Handled "${task.title}" (${task.priority}) as ${assignment.role} with fit ${assignment.fit_score}`,
          source_task_id: task_id,
          confidence: assignment.fit_score / 100,
          tags: [task.priority, assignment.role, dept],
        }];
      });

      const allResults = await Promise.all(aiPromises);
      for (const batch of allResults) {
        if (batch) memories.push(...batch);
      }
    } else {
      // No AI key or no involved agents — heuristic
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

    // Store memories + collaboration records in parallel
    const owners = assignments.filter(a => a.role === 'owner');
    const supporters = assignments.filter(a => a.role === 'support');

    const dbOps: Promise<any>[] = [];
    if (memories.length > 0) {
      dbOps.push(supabase.from('agent_memory').insert(memories));
    }
    if (owners.length > 0 && supporters.length > 0) {
      dbOps.push(supabase.from('agent_collaborations').insert(
        supporters.map(s => ({
          task_id,
          from_agent: s.agent_id,
          to_agent: owners[0].agent_id,
          collab_type: 'share_finding',
          message: `Supported on "${task.title}" with fit score ${s.fit_score}`,
          status: 'completed',
          resolved_at: new Date().toISOString(),
        }))
      ));
    }
    if (dbOps.length > 0) await Promise.all(dbOps);

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
