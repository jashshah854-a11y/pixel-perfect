import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TEMPLATES: Record<string, { system: string; scaffold: string }> = {
  component: {
    system: `You are an expert React/TypeScript developer. Generate a complete, working React component.
Rules:
- Use TypeScript with proper types
- Use Tailwind CSS for styling
- Export the component as default
- Include all imports
- Make it self-contained and runnable
- Return ONLY the code, no markdown fences`,
    scaffold: `import React from "react";\n\nexport default function Component() {\n  return <div>Component</div>;\n}`,
  },
  script: {
    system: `You are an expert developer. Generate a complete, runnable script.
Rules:
- Use TypeScript/JavaScript
- Include all imports needed
- Make it self-contained
- Add console.log for output visibility
- Return ONLY the code, no markdown fences`,
    scaffold: `// Script\nconsole.log("Running...");`,
  },
  "edge-function": {
    system: `You are an expert Deno/Supabase developer. Generate a complete edge function.
Rules:
- Use Deno serve pattern
- Include CORS headers
- Handle OPTIONS preflight
- Use proper error handling
- Return ONLY the code, no markdown fences`,
    scaffold: `import { serve } from "https://deno.land/std@0.168.0/http/server.ts";\n\nserve(async (req) => {\n  return new Response("ok");\n});`,
  },
  query: {
    system: `You are an expert database developer. Generate SQL queries or Supabase client code.
Rules:
- Use Supabase JS client patterns
- Include proper error handling
- Make queries safe and parameterized
- Return ONLY the code, no markdown fences`,
    scaffold: `import { supabase } from "@/integrations/supabase/client";\n\nconst { data, error } = await supabase.from("table").select("*");`,
  },
  utility: {
    system: `You are an expert TypeScript developer. Generate a utility function or module.
Rules:
- Use TypeScript with proper types
- Export all functions
- Include JSDoc comments
- Make it reusable and well-structured
- Return ONLY the code, no markdown fences`,
    scaffold: `export function utility() {\n  // implementation\n}`,
  },
};

function detectOutputType(title: string, description: string): string {
  const text = `${title} ${description}`.toLowerCase();
  if (text.match(/component|page|ui|form|button|modal|dialog|card|layout|widget/)) return "component";
  if (text.match(/edge function|api|endpoint|webhook|server/)) return "edge-function";
  if (text.match(/query|database|sql|select|insert|migration/)) return "query";
  if (text.match(/script|automation|batch|process|cron|job/)) return "script";
  return "utility";
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { task_id } = await req.json();
    if (!task_id) throw new Error("task_id required");

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const [taskRes, assignRes, memoryRes] = await Promise.all([
      supabase.from('tasks').select('*').eq('id', task_id).single(),
      supabase.from('task_assignments').select('agent_id, role, reasoning').eq('task_id', task_id),
      supabase.from('agent_memory').select('content, memory_type, tags').eq('source_task_id', task_id).limit(5),
    ]);

    if (!taskRes.data) throw new Error("Task not found");
    const task = taskRes.data;
    const assignments = assignRes.data || [];
    const memories = memoryRes.data || [];

    const outputType = detectOutputType(task.title, task.description || "");
    const template = TEMPLATES[outputType] || TEMPLATES.utility;

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    let generatedCode = template.scaffold;
    let generationMethod = "template";

    if (LOVABLE_API_KEY) {
      const contextParts = [
        `Task: "${task.title}"`,
        task.description ? `Description: ${task.description}` : "",
        `Priority: ${task.priority}`,
        assignments.length > 0 ? `Assigned agents: ${assignments.map(a => `${a.agent_id} (${a.role})`).join(", ")}` : "",
        memories.length > 0 ? `Related learnings:\n${memories.map(m => `- ${m.content}`).join("\n")}` : "",
        `Output type: ${outputType}`,
        `Starting template:\n${template.scaffold}`,
      ].filter(Boolean).join("\n");

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: template.system },
              { role: "user", content: `Generate production-quality code for this task. Use the template as a starting point but produce a complete, working implementation.\n\n${contextParts}` },
            ],
          }),
        });

        clearTimeout(timeout);

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const content = aiData.choices?.[0]?.message?.content;
          if (content) {
            generatedCode = content
              .replace(/^```(?:tsx?|jsx?|typescript|javascript)?\n?/gm, "")
              .replace(/```$/gm, "")
              .trim();
            generationMethod = "ai";
          }
        } else {
          await aiResponse.text();
        }
      } catch {
        // Fallback to template
      }
    }

    // Determine file format
    const formatMap: Record<string, string> = {
      component: "tsx",
      "edge-function": "ts",
      script: "ts",
      query: "ts",
      utility: "ts",
    };

    // Store as task output
    await supabase.from('task_outputs').insert({
      task_id,
      title: `${task.title} — ${outputType}`,
      content: generatedCode,
      output_type: "code",
      format: formatMap[outputType] || "ts",
    });

    // Notify: task completed
    try {
      const agentName = assignments[0]?.agent_id || 'System';
      await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/notify-event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({
          event_type: 'task_completed',
          payload: { task_id, task_title: task.title, agent_id: agentName, agent_name: agentName },
        }),
      });
    } catch { /* best effort */ }

    // Also generate an execution summary
    const summaryContent = [
      `## Execution: ${task.title}`,
      `\n### Generated Output`,
      `- **Type**: ${outputType}`,
      `- **Format**: ${formatMap[outputType] || "ts"}`,
      `- **Method**: ${generationMethod === "ai" ? "AI-generated from template" : "Template-based"}`,
      `- **Lines**: ${generatedCode.split("\n").length}`,
      assignments.length > 0 ? `- **Agents involved**: ${assignments.map(a => a.agent_id).join(", ")}` : "",
      `\n### Status`,
      `Code generated and ready for review/execution.`,
    ].filter(Boolean).join("\n");

    await supabase.from('task_outputs').insert({
      task_id,
      title: `${task.title} — Execution Summary`,
      content: summaryContent,
      output_type: "report",
      format: "markdown",
    });

    return new Response(JSON.stringify({
      ok: true,
      output_type: outputType,
      generation_method: generationMethod,
      lines: generatedCode.split("\n").length,
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
