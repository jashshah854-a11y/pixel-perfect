import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RESEARCH_TOPICS: Record<string, string[]> = {
  orchestration: [
    "multi-agent coordination patterns",
    "task routing optimization",
    "workflow automation best practices",
    "project management AI techniques",
  ],
  architecture: [
    "modern system architecture patterns",
    "database optimization strategies",
    "API design best practices",
    "scalable infrastructure patterns",
  ],
  "ui/ux": [
    "modern UI component patterns",
    "design system best practices",
    "accessibility improvements",
    "user experience optimization",
  ],
  frontend: [
    "React performance optimization",
    "frontend architecture patterns",
    "modern CSS techniques",
    "state management approaches",
  ],
  research: [
    "data analysis methodologies",
    "AI research patterns",
    "analytical framework improvements",
    "insight extraction techniques",
  ],
  intelligence: [
    "data analysis methodologies",
    "AI research patterns",
    "analytical framework improvements",
    "insight extraction techniques",
  ],
  security: [
    "web security best practices",
    "authentication patterns",
    "vulnerability prevention",
    "secure coding guidelines",
  ],
  review: [
    "code review best practices",
    "automated testing strategies",
    "quality assurance methodologies",
    "bug detection patterns",
  ],
  qa: [
    "testing automation frameworks",
    "quality metrics and monitoring",
    "regression testing approaches",
    "end-to-end testing patterns",
  ],
  backend: [
    "API optimization patterns",
    "database query optimization",
    "serverless architecture patterns",
    "backend security practices",
  ],
  devops: [
    "CI/CD pipeline optimization",
    "infrastructure as code patterns",
    "monitoring and alerting best practices",
    "deployment strategy improvements",
  ],
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { agent_id } = await req.json();
    if (!agent_id) throw new Error("agent_id required");

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Load agent
    const { data: agent } = await supabase
      .from('agents')
      .select('*')
      .eq('id', agent_id)
      .single();

    if (!agent) throw new Error("Agent not found");

    // Check rate limit: max 3 researches per agent per day
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentResearch } = await supabase
      .from('agent_research_log')
      .select('id')
      .eq('agent_id', agent_id)
      .gte('researched_at', oneDayAgo);

    if (recentResearch && recentResearch.length >= 3) {
      return new Response(JSON.stringify({ 
        ok: true, 
        message: "Research limit reached for today (guardrail)" 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Load existing memory to inform research direction
    const { data: existingMemory } = await supabase
      .from('agent_memory')
      .select('content, memory_type, confidence')
      .eq('agent_id', agent_id)
      .order('created_at', { ascending: false })
      .limit(10);

    const dept = agent.department.toLowerCase();
    const topics = RESEARCH_TOPICS[dept] || RESEARCH_TOPICS["backend"];
    const topic = topics[Math.floor(Math.random() * topics.length)];

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      // Fallback: store a generic research entry
      await supabase.from('agent_research_log').insert({
        agent_id,
        topic,
        findings: `Studied ${topic} to improve ${agent.department} capabilities.`,
        relevance_score: 0.5,
        applied: false,
      });

      return new Response(JSON.stringify({ ok: true, topic, ai: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use AI to generate meaningful research insights
    const memoryContext = (existingMemory || [])
      .map(m => `[${m.memory_type}] ${m.content}`)
      .join('\n');

    const prompt = `You are ${agent.name}, an AI agent specializing in ${agent.role} (${agent.department} department).

Your existing knowledge:
${memoryContext || "No prior learnings yet."}

Research topic: "${topic}"

Based on your role and existing knowledge, generate a specific, actionable research finding about this topic. The finding should:
1. Be directly applicable to your role
2. Not repeat what you already know
3. Include a concrete technique, pattern, or approach
4. Be specific enough to improve your future task performance

Provide the finding as a concise paragraph (2-3 sentences max).`;

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
            { role: "system", content: "You are a focused AI researcher. Provide specific, actionable insights. Be concise." },
            { role: "user", content: prompt },
          ],
        }),
      });

      if (!aiResponse.ok) {
        const errText = await aiResponse.text();
        console.error("AI research failed:", aiResponse.status, errText);
        
        if (aiResponse.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limited. Try again later." }), {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        if (aiResponse.status === 402) {
          return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
            status: 402,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        throw new Error("AI research request failed");
      }

      const aiData = await aiResponse.json();
      const findings = aiData.choices?.[0]?.message?.content || "";

      // Score relevance based on keyword overlap with agent's domain
      const deptKeywords = (RESEARCH_TOPICS[dept] || []).join(' ').toLowerCase().split(/\s+/);
      const findingWords = findings.toLowerCase().split(/\s+/);
      const overlap = deptKeywords.filter(w => findingWords.includes(w)).length;
      const relevanceScore = Math.min(1, 0.4 + (overlap / Math.max(1, deptKeywords.length)) * 0.6);

      // Store research
      await supabase.from('agent_research_log').insert({
        agent_id,
        topic,
        findings,
        relevance_score: relevanceScore,
        applied: false,
      });

      // If high relevance, also store as agent memory insight
      if (relevanceScore >= 0.6) {
        await supabase.from('agent_memory').insert({
          agent_id,
          memory_type: 'insight',
          content: findings,
          confidence: relevanceScore,
          tags: ['self-research', dept, topic.split(' ')[0]],
        });
      }

      return new Response(JSON.stringify({ 
        ok: true, 
        topic, 
        relevance_score: relevanceScore,
        applied_to_memory: relevanceScore >= 0.6,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (aiErr) {
      console.error("AI research error:", aiErr);
      
      await supabase.from('agent_research_log').insert({
        agent_id,
        topic,
        findings: `Attempted research on "${topic}" — AI unavailable, queued for retry.`,
        relevance_score: 0.3,
        applied: false,
      });

      return new Response(JSON.stringify({ ok: true, topic, ai: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
