import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Department → keyword affinity map
const DEPT_KEYWORDS: Record<string, string[]> = {
  orchestration: ["coordinate", "plan", "manage", "organize", "schedule", "workflow", "pipeline", "integrate", "orchestrate", "project"],
  architecture:  ["design", "system", "infrastructure", "scale", "architecture", "database", "schema", "migrate", "structure", "refactor"],
  frontend:      ["ui", "ux", "design", "component", "page", "layout", "style", "responsive", "interface", "visual", "css", "react", "animation"],
  intelligence:  ["data", "analysis", "research", "insight", "report", "metric", "predict", "model", "ai", "ml", "analytics", "sweep"],
  security:      ["security", "auth", "permission", "encrypt", "audit", "vulnerability", "compliance", "protect", "firewall", "rls"],
  qa:            ["test", "quality", "bug", "verify", "validate", "regression", "coverage", "e2e", "debug", "fix"],
  backend:       ["api", "server", "endpoint", "function", "database", "query", "storage", "deploy", "edge", "webhook", "backend"],
};

function scoreAgent(agent: { department: string; role: string; status: string }, taskText: string): { score: number; reasons: string[] } {
  const text = taskText.toLowerCase();
  const dept = agent.department.toLowerCase();
  const keywords = DEPT_KEYWORDS[dept] || [];
  const reasons: string[] = [];
  let score = 0;

  // Keyword matching (up to 60 points)
  const matched = keywords.filter(kw => text.includes(kw));
  const keywordScore = Math.min(matched.length * 15, 60);
  score += keywordScore;
  if (matched.length > 0) {
    reasons.push(`Keyword match: ${matched.slice(0, 3).join(", ")}`);
  }

  // Role relevance bonus (up to 20 points)
  const roleWords = agent.role.toLowerCase().split(/\s+/);
  const roleMatched = roleWords.filter(w => text.includes(w));
  if (roleMatched.length > 0) {
    score += Math.min(roleMatched.length * 10, 20);
    reasons.push(`Role relevance: ${agent.role}`);
  }

  // Availability bonus
  if (agent.status === "idle") {
    score += 15;
    reasons.push("Currently idle and available");
  } else if (agent.status === "working") {
    score += 5;
    reasons.push("Currently busy, lower priority");
  }

  // Base competency - every agent gets a small score
  score += 5;

  return { score: Math.min(score, 100), reasons };
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

    // Load task and agents
    const [taskRes, agentsRes] = await Promise.all([
      supabase.from('tasks').select('*').eq('id', task_id).single(),
      supabase.from('agents').select('*'),
    ]);

    if (!taskRes.data) throw new Error("Task not found");
    const task = taskRes.data;
    const agents = agentsRes.data || [];

    const taskText = `${task.title} ${task.description || ""}`;

    // Score all agents
    const scored = agents.map(agent => {
      const { score, reasons } = scoreAgent(agent, taskText);
      return { agent, score, reasons };
    }).sort((a, b) => b.score - a.score);

    // Assign roles
    const assignments = scored.map((s, i) => {
      let role = "observer";
      if (i === 0 && s.score >= 20) role = "owner";
      else if (s.score >= 50) role = "support";

      return {
        task_id,
        agent_id: s.agent.id,
        role,
        fit_score: s.score,
        reasoning: s.reasons.length > 0 ? s.reasons.join(". ") : "No strong match",
      };
    });

    // Insert assignments
    await supabase.from('task_assignments').insert(assignments);

    // Find owner
    const owner = assignments.find(a => a.role === "owner");

    if (owner) {
      // Update task: assign to owner and set in_progress
      await supabase.from('tasks').update({
        assigned_to: owner.agent_id,
        status: 'in_progress',
      }).eq('id', task_id);

      // Update owner agent status
      await supabase.from('agents').update({
        status: 'working',
        current_task: task.title,
        last_active: new Date().toISOString(),
      }).eq('id', owner.agent_id);

      // Send inbox notification
      await supabase.from('inbox').insert({
        from_agent: owner.agent_id,
        message: `Claimed task: "${task.title}" (fit score: ${owner.fit_score}/100)`,
        type: 'task_claim',
      });
    }

    return new Response(JSON.stringify({ 
      ok: true, 
      owner: owner?.agent_id || null,
      assignments: assignments.map(a => ({ 
        agent_id: a.agent_id, 
        role: a.role, 
        fit_score: a.fit_score 
      }))
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
