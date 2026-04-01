import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { neon } from "npm:@neondatabase/serverless";
import { createClient } from "npm:@supabase/supabase-js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const sql = neon(Deno.env.get('NEON_DATABASE_URL')!);
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const jobs = await sql`
      SELECT company, job_title, ghost_score, fit_score, verdict, apply_url, 
             ghost_flags as flags, scraped_at as swept_at, location, salary 
      FROM screened_jobs 
      WHERE verdict IN ('apply', 'maybe') 
      ORDER BY fit_score DESC, ghost_score DESC 
      LIMIT 100
    `;

    let synced = 0;
    for (const job of jobs) {
      const { error } = await supabase.from('sweep_results').upsert({
        company: job.company,
        job_title: job.job_title,
        ghost_score: job.ghost_score || 0,
        fit_score: job.fit_score || 0,
        verdict: job.verdict,
        apply_url: job.apply_url,
        flags: job.flags || [],
        swept_at: job.swept_at || new Date().toISOString(),
        location: job.location || null,
        salary: job.salary || null,
      }, { onConflict: 'company,job_title' });
      if (!error) synced++;
    }

    return new Response(JSON.stringify({ synced, total: jobs.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
