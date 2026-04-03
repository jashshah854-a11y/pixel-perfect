import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TEMPLATES: Record<string, { system: string; scaffold: string }> = {
  component: {
    system: `You are an expert React/TypeScript developer. Generate a COMPLETE, PRODUCTION-QUALITY React component.
Rules:
- Use TypeScript with proper types and interfaces
- Use Tailwind CSS for all styling
- Export the component as default
- Include ALL imports
- Make it fully functional with state management where needed
- Include proper event handlers
- Add comments explaining key logic
- The component must be 50+ lines minimum
- Return ONLY the code, no markdown fences`,
    scaffold: `import React, { useState } from "react";\n\nexport default function Component() {\n  return <div>Component</div>;\n}`,
  },
  script: {
    system: `You are an expert developer. Generate a COMPLETE, runnable script with real logic.
Rules:
- Use TypeScript/JavaScript
- Include all imports needed
- Implement actual business logic, not placeholder code
- Add comprehensive console.log for output visibility
- Handle edge cases and errors
- Minimum 40 lines of real code
- Return ONLY the code, no markdown fences`,
    scaffold: `// Script\nconsole.log("Running...");`,
  },
  "edge-function": {
    system: `You are an expert Deno/Supabase developer. Generate a COMPLETE edge function with real logic.
Rules:
- Use Deno serve pattern with full CORS
- Include input validation
- Implement actual database operations or API calls
- Handle all error cases with proper status codes
- Add logging for observability
- Minimum 60 lines
- Return ONLY the code, no markdown fences`,
    scaffold: `import { serve } from "https://deno.land/std@0.168.0/http/server.ts";\n\nserve(async (req) => {\n  return new Response("ok");\n});`,
  },
  query: {
    system: `You are an expert database developer. Generate REAL database queries or data operations.
Rules:
- Use Supabase JS client patterns
- Include proper error handling and validation
- Write actual queries that solve the described problem
- Include data transformation logic
- Minimum 30 lines
- Return ONLY the code, no markdown fences`,
    scaffold: `import { supabase } from "@/integrations/supabase/client";\n\nconst { data, error } = await supabase.from("table").select("*");`,
  },
  research: {
    system: `You are an expert analyst. Generate a COMPREHENSIVE research report.
Rules:
- Structure with clear headings
- Include specific findings with data points
- Provide actionable recommendations
- Compare alternatives where relevant
- Include sources or references where possible
- Minimum 500 words
- Return structured markdown`,
    scaffold: `## Research Report\n\n### Executive Summary\n\n### Findings\n\n### Recommendations`,
  },
  utility: {
    system: `You are an expert TypeScript developer. Generate a COMPLETE utility module.
Rules:
- Use TypeScript with proper types
- Export all functions with JSDoc comments
- Include comprehensive error handling
- Add unit test examples in comments
- Make it production-ready
- Minimum 40 lines
- Return ONLY the code, no markdown fences`,
    scaffold: `export function utility() {\n  // implementation\n}`,
  },
};

function detectOutputType(title: string, description: string): string {
  const text = `${title} ${description}`.toLowerCase();
  if (text.match(/component|page|ui|form|button|modal|dialog|card|layout|widget|dashboard/)) return "component";
  if (text.match(/edge function|api|endpoint|webhook|server/)) return "edge-function";
  if (text.match(/query|database|sql|select|insert|migration/)) return "query";
  if (text.match(/script|automation|batch|process|cron|job/)) return "script";
  if (text.match(/research|analyze|compare|evaluate|benchmark|investigate|report|study/)) return "research";
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

    // Load task, assignments, memory, research, and prior outputs in parallel
    const [taskRes, assignRes, memoryRes, researchRes, priorOutputsRes] = await Promise.all([
      supabase.from('tasks').select('*').eq('id', task_id).single(),
      supabase.from('task_assignments').select('agent_id, role, reasoning').eq('task_id', task_id),
      supabase.from('agent_memory').select('content, memory_type, tags, confidence')
        .order('confidence', { ascending: false }).limit(10),
      supabase.from('agent_research_log').select('topic, findings, source_url, relevance_score')
        .order('researched_at', { ascending: false }).limit(5),
      supabase.from('task_outputs').select('title, content, output_type')
        .eq('task_id', task_id).limit(1),
    ]);

    if (!taskRes.data) throw new Error("Task not found");

    // Skip if already has code output
    if (priorOutputsRes.data && priorOutputsRes.data.some(o => o.output_type === 'code')) {
      return new Response(JSON.stringify({ ok: true, message: "Already executed" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const task = taskRes.data;
    const assignments = assignRes.data || [];
    const memories = memoryRes.data || [];
    const research = researchRes.data || [];

    const outputType = detectOutputType(task.title, task.description || "");
    const template = TEMPLATES[outputType] || TEMPLATES.utility;

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    let generatedCode = template.scaffold;
    let generationMethod = "template";

    if (LOVABLE_API_KEY) {
      // Build rich context from all available sources
      const contextParts = [
        `# Task: "${task.title}"`,
        task.description ? `## Description\n${task.description}` : "",
        `## Priority: ${task.priority}`,
        `## Required Output Type: ${outputType}`,
        assignments.length > 0 ? `## Assigned Agents\n${assignments.map(a => `- ${a.agent_id} (${a.role}): ${a.reasoning || 'no reasoning'}`).join("\n")}` : "",
        memories.length > 0 ? `## Relevant Agent Learnings\n${memories.slice(0, 5).map(m => `- [${m.memory_type}, confidence: ${m.confidence}] ${m.content}`).join("\n")}` : "",
        research.length > 0 ? `## Research Context\n${research.slice(0, 3).map(r => `- Topic: ${r.topic} (relevance: ${r.relevance_score})\n  ${r.findings?.slice(0, 300) || 'No findings'}\n  ${r.source_url ? `Source: ${r.source_url}` : ''}`).join("\n")}` : "",
        `## Quality Requirements`,
        `- MINIMUM ${outputType === 'research' ? '500 words' : '50 lines of code'}`,
        `- Must be COMPLETE and PRODUCTION-READY`,
        `- No placeholder comments like "// TODO" or "// implement here"`,
        `- Must include error handling`,
        `- Must be directly usable without modification`,
      ].filter(Boolean).join("\n\n");

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 25000);

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
              { role: "user", content: `Generate a COMPLETE, PRODUCTION-QUALITY implementation for this task. This output will be used directly — do not produce placeholder or stub code.\n\n${contextParts}` },
            ],
          }),
        });

        clearTimeout(timeout);

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const content = aiData.choices?.[0]?.message?.content;
          if (content) {
            generatedCode = content
              .replace(/^```(?:tsx?|jsx?|typescript|javascript|markdown|md)?\n?/gm, "")
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

    const formatMap: Record<string, string> = {
      component: "tsx",
      "edge-function": "ts",
      script: "ts",
      query: "ts",
      research: "markdown",
      utility: "ts",
    };

    // Store primary output
    await supabase.from('task_outputs').insert({
      task_id,
      title: `${task.title} — ${outputType}`,
      content: generatedCode,
      output_type: "code",
      format: formatMap[outputType] || "ts",
    });

    // Generate execution summary
    const summaryContent = [
      `## Execution Report: ${task.title}`,
      `\n### Output Details`,
      `- **Type**: ${outputType}`,
      `- **Format**: ${formatMap[outputType] || "ts"}`,
      `- **Method**: ${generationMethod === "ai" ? "AI-generated (Gemini)" : "Template-based"}`,
      `- **Lines**: ${generatedCode.split("\n").length}`,
      `- **Characters**: ${generatedCode.length}`,
      assignments.length > 0 ? `- **Agents**: ${assignments.map(a => `${a.agent_id} (${a.role})`).join(", ")}` : "",
      research.length > 0 ? `- **Research used**: ${research.length} source(s)` : "",
      memories.length > 0 ? `- **Learnings applied**: ${memories.length} memory entries` : "",
      `\n### Validation`,
      `- Lines: ${generatedCode.split("\n").length} (min: 10)`,
      `- Chars: ${generatedCode.length} (min: 200)`,
      `- Status: ${generatedCode.split("\n").length >= 10 && generatedCode.length >= 200 ? '✅ PASSED' : '⚠️ BELOW THRESHOLD'}`,
    ].filter(Boolean).join("\n");

    await supabase.from('task_outputs').insert({
      task_id,
      title: `${task.title} — Execution Report`,
      content: summaryContent,
      output_type: "report",
      format: "markdown",
    });

    // Notify completion
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

    return new Response(JSON.stringify({
      ok: true,
      output_type: outputType,
      generation_method: generationMethod,
      lines: generatedCode.split("\n").length,
      chars: generatedCode.length,
      research_context: research.length,
      memory_context: memories.length,
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
