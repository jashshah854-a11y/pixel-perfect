import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

type CheckResult = { success: boolean; message: string };
type Checker = (url: string, config: Record<string, any>) => Promise<CheckResult>;

const HEALTH_CHECKS: Record<string, Checker> = {
  openai: async (url, _config) => {
    const res = await fetch(`${url}/models`, {
      headers: { 'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY') || ''}` }
    });
    if (res.ok) {
      const data = await res.json();
      return { success: true, message: `Authenticated. ${data.data?.length || 0} models available` };
    }
    const text = await res.text();
    return { success: false, message: `${res.status} ${res.statusText}` };
  },

  gemini: async (url, config) => {
    const key = Deno.env.get('GEMINI_API_KEY') || '';
    const res = await fetch(`${url}/models?key=${key}`);
    if (res.ok) {
      const data = await res.json();
      return { success: true, message: `Authenticated. ${data.models?.length || 0} models available` };
    }
    const text = await res.text();
    return { success: false, message: `${res.status} ${res.statusText}` };
  },

  'ghost-sweep': async (url) => {
    const res = await fetch(`${url}/health`);
    if (res.ok) {
      const text = await res.text();
      return { success: true, message: `Server healthy: ${text.slice(0, 100)}` };
    }
    return { success: false, message: `${res.status} - server may be down` };
  },

  neon: async () => {
    try {
      const { neon } = await import("npm:@neondatabase/serverless");
      const sql = neon(Deno.env.get('NEON_DATABASE_URL')!);
      const result = await sql`SELECT COUNT(*) as tables FROM information_schema.tables WHERE table_schema = 'public'`;
      return { success: true, message: `Connected. ${result[0].tables} public tables` };
    } catch (e) {
      return { success: false, message: `Connection failed: ${e.message}` };
    }
  },

  apify: async () => {
    const token = Deno.env.get('APIFY_TOKEN') || '';
    const res = await fetch(`https://api.apify.com/v2/users/me?token=${token}`);
    if (res.ok) {
      const data = await res.json();
      return { success: true, message: `Authenticated as ${data.data?.username || 'user'}` };
    }
    const text = await res.text();
    return { success: false, message: `${res.status} - check APIFY_TOKEN` };
  },

  exa: async () => {
    const res = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': Deno.env.get('EXA_API_KEY') || ''
      },
      body: JSON.stringify({ query: 'test', numResults: 1 })
    });
    if (res.ok) return { success: true, message: 'Authenticated. Search API working' };
    const text = await res.text();
    return { success: false, message: `${res.status} - check EXA_API_KEY` };
  },

  railway: async () => {
    const token = Deno.env.get('RAILWAY_API_TOKEN') || '';
    const res = await fetch('https://backboard.railway.com/graphql/v2', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: '{ me { name email } }' })
    });
    if (res.ok) {
      const data = await res.json();
      return { success: true, message: `Authenticated as ${data.data?.me?.email || 'user'}` };
    }
    const text = await res.text();
    return { success: false, message: `${res.status} - check RAILWAY_API_TOKEN` };
  },

  github: async () => {
    // No GitHub token stored — just verify API is reachable
    const res = await fetch('https://api.github.com/rate_limit');
    if (res.ok) return { success: true, message: 'GitHub API reachable' };
    return { success: false, message: `${res.status} ${res.statusText}` };
  },

  local: async () => {
    return { success: true, message: 'Local tool — verify manually on your machine' };
  },

  gmail: async () => {
    return { success: true, message: 'Gmail uses OAuth — verify in browser' };
  },

  perplexity: async () => {
    return { success: true, message: 'Perplexity — no API key configured for server test' };
  },
};

const TOOL_TYPE_MAP: Record<string, string> = {
  'claude-code': 'local',
  'codex': 'openai',
  'gemini-1': 'gemini',
  'gemini-2': 'gemini',
  'chatgpt': 'openai',
  'perplexity': 'perplexity',
  'lovable': 'local',
  'railway': 'railway',
  'ghost-sweep': 'ghost-sweep',
  'neon-db': 'neon',
  'apify': 'apify',
  'exa': 'exa',
  'n8n': 'ghost-sweep',
  'ruflo': 'local',
  'github': 'github',
  'gmail-primary': 'gmail',
  'gmail-secondary': 'gmail',
  'pace-email': 'gmail',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { tool_id } = await req.json();
    if (!tool_id) {
      return new Response(JSON.stringify({ success: false, message: 'Missing tool_id' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: tool } = await supabase
      .from('tool_connections')
      .select('*')
      .eq('id', tool_id)
      .single();

    if (!tool) {
      return new Response(JSON.stringify({ success: false, message: 'Tool not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const checkType = TOOL_TYPE_MAP[tool_id] || 'local';
    const checker = HEALTH_CHECKS[checkType] || HEALTH_CHECKS['local'];

    const start = Date.now();
    const result = await checker(tool.api_url || '', tool.config || {});
    const latency_ms = Date.now() - start;

    // Update status and last_ping
    await supabase
      .from('tool_connections')
      .update({
        status: result.success ? (tool.status === 'needs_setup' ? 'active' : tool.status === 'available' ? 'available' : 'active') : 'needs_setup',
        last_ping: new Date().toISOString(),
      })
      .eq('id', tool_id);

    return new Response(JSON.stringify({ ...result, latency_ms }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, message: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
