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
  agent: { id: string; department: string; role: string; status: string },
  taskText: string,
  memories: MemoryEntry[],
  completedCount: number
): { score: number; reasons: string[]; confidence: number } {
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
  let memoryBoost = 0;
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

    memoryBoost = Math.min(Math.round(memoryScore * 5), 25);
    if (memoryBoost > 0) {
      score += memoryBoost;
      reasons.push(`Memory boost +${memoryBoost}: "${bestMemory}..."`);
    }
  }

  // === Experience confidence (up to 15 bonus points) ===
  const experienceBonus = Math.min(completedCount * 3, 15);
  if (experienceBonus > 0) {
    score += experienceBonus;
    reasons.push(`Experience bonus +${experienceBonus} (${completedCount} tasks completed)`);
  }

  // Base competency
  score += 5;
  score = Math.min(score, 100);

  // Calculate confidence as separate metric
  const confidence = Math.min(
    Math.round((keywordScore / 60) * 40 + (memoryBoost / 25) * 30 + (experienceBonus / 15) * 20 + 10),
    100
  );

  // Prediction accuracy bonus from past suggestions
  const predictionBonus = Math.min(Math.round(completedCount * 0.5), 5);
  score = Math.min(score + predictionBonus, 100);

  return { score, reasons, confidence };
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

    // Load task, agents, memories, and completion history
    const [taskRes, agentsRes, memoriesRes, completionsRes] = await Promise.all([
      supabase.from('tasks').select('*').eq('id', task_id).single(),
      supabase.from('agents').select('*'),
      supabase.from('agent_memory').select('agent_id, content, confidence, tags, memory_type').order('confidence', { ascending: false }).limit(200),
      supabase.from('task_assignments').select('agent_id, role').eq('role', 'owner'),
    ]);

    if (!taskRes.data) throw new Error("Task not found");
    const task = taskRes.data;
    const agents = agentsRes.data || [];
    const allMemories = memoriesRes.data || [];
    const completions = completionsRes.data || [];

    // Group memories by agent
    const memByAgent: Record<string, MemoryEntry[]> = {};
    for (const m of allMemories) {
      if (!memByAgent[m.agent_id]) memByAgent[m.agent_id] = [];
      memByAgent[m.agent_id].push(m);
    }

    // Count completions per agent
    const completionCounts: Record<string, number> = {};
    for (const c of completions) {
      completionCounts[c.agent_id] = (completionCounts[c.agent_id] || 0) + 1;
    }

    const taskText = `${task.title} ${task.description || ""}`;

    // Score all agents with memory + experience awareness
    const scored = agents.map(agent => {
      const agentMemories = memByAgent[agent.id] || [];
      const completed = completionCounts[agent.id] || 0;
      const { score, reasons, confidence } = scoreAgent(agent, taskText, agentMemories, completed);
      return { agent, score, reasons, confidence };
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
        reasoning: s.reasons.length > 0 
          ? `[Confidence: ${s.confidence}%] ${s.reasons.join(". ")}` 
          : `[Confidence: ${s.confidence}%] No strong match`,
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

      const ownerScored = scored.find(s => s.agent.id === owner.agent_id);
      await supabase.from('inbox').insert({
        from_agent: owner.agent_id,
        message: `Claimed task: "${task.title}" (fit: ${owner.fit_score}/100, confidence: ${ownerScored?.confidence || 0}%)`,
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
      owner_name: owner ? scored.find(s => s.agent.id === owner.agent_id)?.agent.name : null,
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
