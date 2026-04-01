import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { neon } from "npm:@neondatabase/serverless";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const sql = neon(Deno.env.get('NEON_DATABASE_URL')!);

    await sql`
      INSERT INTO job_applications (company, position, status, applied_via, fit_score, screening_verdict) 
      VALUES (${body.company}, ${body.job_title}, 'applied', ${body.apply_url || 'direct'}, ${body.fit_score || 0}, ${body.verdict || 'apply'}) 
      ON CONFLICT DO NOTHING
    `;

    return new Response(JSON.stringify({ logged: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
