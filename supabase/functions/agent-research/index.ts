import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const { agent_id, topic, task_id, use_exa } = body;
    if (!agent_id) throw new Error("agent_id required");

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Load agent
    const { data: agent } = await supabase
      .from('agents').select('*').eq('id', agent_id).single();
    if (!agent) throw new Error("Agent not found");

    // Rate limit: max 5 per agent per day
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentResearch } = await supabase
      .from('agent_research_log').select('id')
      .eq('agent_id', agent_id).gte('researched_at', oneDayAgo);
    if (recentResearch && recentResearch.length >= 5) {
      return new Response(JSON.stringify({ ok: true, message: "Research limit reached" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const searchTopic = topic || `${agent.department} best practices`;
    const EXA_API_KEY = Deno.env.get('EXA_API_KEY');

    let findings = '';
    let sourceUrl: string | null = null;
    let relevanceScore = 0.5;
    let searchMethod = 'fallback';

    // ===== REAL SEARCH via Exa API =====
    if (EXA_API_KEY) {
      try {
        const exaResponse = await fetch('https://api.exa.ai/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': EXA_API_KEY,
          },
          body: JSON.stringify({
            query: searchTopic,
            numResults: 5,
            useAutoprompt: true,
            type: 'auto',
            contents: {
              text: { maxCharacters: 1000 },
              highlights: { numSentences: 3 },
            },
          }),
        });

        if (exaResponse.ok) {
          const exaData = await exaResponse.json();
          const results = exaData.results || [];
          searchMethod = 'exa';

          if (results.length > 0) {
            // Build structured findings from real search results
            const sourceSummaries = results.slice(0, 3).map((r: any, i: number) => {
              const highlights = r.highlights?.join(' ') || r.text?.slice(0, 300) || 'No content';
              return `**Source ${i + 1}**: [${r.title || 'Untitled'}](${r.url})\n${highlights}`;
            });

            sourceUrl = results[0]?.url || null;
            findings = [
              `## Research: ${searchTopic}`,
              `\n### Sources Found: ${results.length}`,
              ...sourceSummaries,
              `\n### Key Takeaways`,
            ].join('\n');

            // Use AI to synthesize findings if available
            const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
            if (LOVABLE_API_KEY) {
              try {
                const rawContent = results.map((r: any) =>
                  `Title: ${r.title}\nURL: ${r.url}\nContent: ${(r.text || r.highlights?.join(' ') || '').slice(0, 500)}`
                ).join('\n---\n');

                const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${LOVABLE_API_KEY}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    model: "google/gemini-2.5-flash-lite",
                    messages: [
                      { role: "system", content: "Synthesize search results into actionable findings. Be specific and practical. Include concrete recommendations." },
                      { role: "user", content: `Topic: ${searchTopic}\n\nSearch results:\n${rawContent}\n\nProvide 3-5 specific, actionable findings with concrete recommendations.` },
                    ],
                  }),
                });

                if (aiRes.ok) {
                  const aiData = await aiRes.json();
                  const synthesis = aiData.choices?.[0]?.message?.content;
                  if (synthesis) {
                    findings += `\n${synthesis}`;
                  }
                } else {
                  await aiRes.text();
                }
              } catch { /* AI synthesis is best-effort */ }
            }

            // Calculate real relevance based on result quality
            const avgScore = results.reduce((s: number, r: any) => s + (r.score || 0.5), 0) / results.length;
            relevanceScore = Math.min(1, avgScore * 0.8 + 0.2);
          }
        } else {
          const errText = await exaResponse.text();
          console.error("Exa API error:", exaResponse.status, errText);
        }
      } catch (e) {
        console.error("Exa search failed:", e);
      }
    }

    // ===== Fallback: AI-only research (clearly labeled) =====
    if (searchMethod === 'fallback') {
      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      if (LOVABLE_API_KEY) {
        try {
          const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              messages: [
                { role: "system", content: "You are a research assistant. Provide specific, actionable findings. Clearly state these are from your training data, not live search." },
                { role: "user", content: `Research topic: "${searchTopic}" for a ${agent.role} agent in ${agent.department}. Provide 3 specific, actionable findings.` },
              ],
            }),
          });
          if (aiRes.ok) {
            const aiData = await aiRes.json();
            findings = `## Research: ${searchTopic}\n\n⚠️ *Based on AI knowledge, not live search (Exa API not available)*\n\n${aiData.choices?.[0]?.message?.content || 'No findings'}`;
            relevanceScore = 0.4; // Lower score for non-grounded research
            searchMethod = 'ai_only';
          } else {
            await aiRes.text();
          }
        } catch { /* fallback */ }
      }

      if (!findings) {
        findings = `Attempted research on "${searchTopic}" — external search unavailable.`;
        relevanceScore = 0.2;
      }
    }

    // Store research
    await supabase.from('agent_research_log').insert({
      agent_id,
      topic: searchTopic,
      findings,
      relevance_score: relevanceScore,
      source_url: sourceUrl,
      applied: false,
    });

    // Store as memory if high relevance
    if (relevanceScore >= 0.5) {
      await supabase.from('agent_memory').insert({
        agent_id,
        memory_type: 'insight',
        content: findings.slice(0, 500),
        confidence: relevanceScore,
        source_task_id: task_id || null,
        tags: ['research', searchMethod, agent.department.toLowerCase()],
      });
    }

    // Create inbox notification for research completion
    try {
      const BASE = Deno.env.get('SUPABASE_URL')!;
      const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      await fetch(`${BASE}/functions/v1/notify-event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${KEY}` },
        body: JSON.stringify({
          event_type: 'research_suggestion',
          payload: {
            agent_id,
            agent_name: agent.name,
            topic: searchTopic,
            findings: findings.slice(0, 300),
            source_url: sourceUrl,
          },
        }),
      });
    } catch { /* best effort */ }

    return new Response(JSON.stringify({
      ok: true,
      topic: searchTopic,
      search_method: searchMethod,
      relevance_score: relevanceScore,
      source_url: sourceUrl,
      findings_length: findings.length,
      applied_to_memory: relevanceScore >= 0.5,
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
