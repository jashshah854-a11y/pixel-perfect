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

interface MemoryEntry {
  content: string;
  confidence: number;
  tags: string[];
  memory_type: string;
}

function scoreAgent(
  agent: { department: string; role: string; status: string },
  taskText: string,
  memories: MemoryEntry[]
): { score: number; reasons: string[] } {
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

  // === Memory-aware scoring (up to 25 bonus points) ===
  if (memories.length > 0) {
    const taskWords = text.split(/\s+/).filter(w => w.length > 3);
    let memoryScore = 0;
    let bestMemory = "";

    for (const mem of memories) {
      const memWords = mem.content.toLowerCase().split(/\s+/);
      const tagOverlap = (mem.tags || []).filter(t => text.includes(t.toLowerCase())).length;
      const contentOverlap = taskWords.filter(w => memWords.includes(w)).length;
      const relevance = (tagOverlap * 3 + contentOverlap) * mem.confidence;

      if (relevance > memoryScore) {
        memoryScore = relevance;
        bestMemory = mem.content.slice(0, 50);
      }
    }

    const memBonus = Math.min(Math.round(memoryScore * 5), 25);
    if (memBonus > 0) {
      score += memBonus;
      reasons.push(`Memory boost +${memBonus}: "${bestMemory}..."`);
    }
  }

  // Base competency
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

    // Load task, agents, and all agent memories
    const [taskRes, agentsRes, memoriesRes] = await Promise.all([
      supabase.from('tasks').select('*').eq('id', task_id).single(),
      supabase.from('agents').select('*'),
      supabase.from('agent_memory').select('agent_id, content, confidence, tags, memory_type').order('confidence', { ascending: false }).limit(200),
    ]);

    if (!taskRes.data) throw new Error("Task not found");
    const task = taskRes.data;
    const agents = agentsRes.data || [];
    const allMemories = memoriesRes.data || [];

    // Group memories by agent
    const memByAgent: Record<string, MemoryEntry[]> = {};
    for (const m of allMemories) {
      if (!memByAgent[m.agent_id]) memByAgent[m.agent_id] = [];
      memByAgent[m.agent_id].push(m);
    }

    const taskText = `${task.title} ${task.description || ""}`;

    // Score all agents with memory awareness
    const scored = agents.map(agent => {
      const agentMemories = memByAgent[agent.id] || [];
      const { score, reasons } = scoreAgent(agent, taskText, agentMemories);
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
      await supabase.from('tasks').update({
        assigned_to: owner.agent_id,
        status: 'in_progress',
      }).eq('id', task_id);

      await supabase.from('agents').update({
        status: 'working',
        current_task: task.title,
        last_active: new Date().toISOString(),
      }).eq('id', owner.agent_id);

      await supabase.from('inbox').insert({
        from_agent: owner.agent_id,
        message: `Claimed task: "${task.title}" (fit score: ${owner.fit_score}/100)`,
        type: 'task_claim',
      });

      // Create collaboration records for support agents
      const supporters = assignments.filter(a => a.role === "support");
      if (supporters.length > 0) {
        const collabs = supporters.map(s => ({
          task_id,
          from_agent: s.agent_id,
          to_agent: owner.agent_id,
          collab_type: 'task_support',
          message: `Supporting "${task.title}" (fit: ${s.fit_score})`,
          status: 'in_progress',
        }));
        await supabase.from('agent_collaborations').insert(collabs);
      }
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
