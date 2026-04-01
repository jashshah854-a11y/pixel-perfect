import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { neon } from "npm:@neondatabase/serverless";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const sql = neon(Deno.env.get('NEON_DATABASE_URL')!);

    const appCount = await sql`SELECT COUNT(*) as count FROM job_applications`;
    const byStatus = await sql`SELECT screening_verdict as status, COUNT(*) as count FROM job_applications GROUP BY screening_verdict`;
    const sweepRuns = await sql`SELECT id, started_at, finished_at, scraped_count, apply_count, maybe_count, skip_count, cost_usd, duration_ms, status FROM sweep_runs ORDER BY started_at DESC LIMIT 10`;
    const queued = await sql`SELECT COUNT(*) as count FROM screened_jobs WHERE verdict = 'apply'`;
    const ghosts = await sql`SELECT COUNT(*) as count FROM ghost_signals WHERE scored = true`;

    return new Response(JSON.stringify({
      total_applications: parseInt(appCount[0]?.count || '0'),
      by_status: byStatus,
      recent_sweeps: sweepRuns,
      jobs_queued: parseInt(queued[0]?.count || '0'),
      ghost_signals_scored: parseInt(ghosts[0]?.count || '0'),
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
