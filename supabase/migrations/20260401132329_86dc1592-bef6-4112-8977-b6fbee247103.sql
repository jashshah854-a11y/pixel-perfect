
-- Add unique constraint on sweep_results for upsert support
ALTER TABLE sweep_results ADD CONSTRAINT sweep_results_company_title_unique UNIQUE (company, job_title);

-- Add location and salary columns to sweep_results for Neon sync
ALTER TABLE sweep_results ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE sweep_results ADD COLUMN IF NOT EXISTS salary TEXT;

-- Create tool_connections table
CREATE TABLE public.tool_connections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT DEFAULT 'disconnected',
  api_url TEXT,
  config JSONB DEFAULT '{}',
  last_ping TIMESTAMPTZ,
  notes TEXT
);

-- Seed all 20 tools (no API keys stored in DB)
INSERT INTO tool_connections (id, name, category, status, api_url, config, notes) VALUES
  ('claude-code', 'Claude Code', 'AI IDE', 'active', NULL, '{"role": "Primary orchestrator"}', 'Primary agent, spawns all other agents'),
  ('cursor-ai', 'Cursor AI', 'AI IDE', 'available', NULL, '{"role": "Multi-file edits, codebase refactors"}', 'Use for large refactors and multi-file changes'),
  ('antigravity', 'Anti-Gravity IDE', 'AI IDE', 'available', NULL, '{"role": "Google Gemini-powered IDE", "provider": "Google"}', 'Gemini-backed IDE for architecture review'),
  ('codex', 'OpenAI Codex', 'AI Agent', 'needs_setup', 'https://api.openai.com/v1', '{"role": "Async background tasks, large changes"}', 'Async agent for background coding tasks'),
  ('gemini-1', 'Gemini Pro Account 1', 'AI Model', 'active', 'https://generativelanguage.googleapis.com/v1beta', '{"model": "gemini-2.0-flash", "role": "Architecture review, market analysis"}', 'Primary Gemini account'),
  ('gemini-2', 'Gemini Pro Account 2', 'AI Model', 'available', 'https://generativelanguage.googleapis.com/v1beta', '{"model": "gemini-2.0-flash", "role": "Backup/parallel processing"}', 'Secondary Gemini account for parallel workloads'),
  ('chatgpt', 'ChatGPT', 'AI Model', 'available', 'https://api.openai.com/v1', '{"role": "Research, writing, brainstorming"}', 'Research and writing tasks'),
  ('perplexity', 'Perplexity', 'AI Search', 'available', 'https://api.perplexity.ai', '{"role": "Real-time data, fact-checking"}', 'Live web search and fact verification'),
  ('lovable', 'Lovable', 'UI Builder', 'active', 'https://lovable.dev', '{"credits_remaining": 200, "role": "UI prototyping, dashboard building"}', 'This app was built with Lovable'),
  ('railway', 'Railway', 'Infrastructure', 'active', 'https://backboard.railway.com/graphql/v2', '{"project_id": "4f2e78bd-30e4-49a4-ac74-c3de47c365b4", "plan": "hobby"}', 'Ghost Sweep server runs here'),
  ('ghost-sweep', 'Ghost Sweep', 'Job Pipeline', 'active', 'https://ghost-sweep-production.up.railway.app', '{"endpoints": {"/ghost-sweep": "POST trigger", "/health": "GET health check"}}', 'Job scraping + scoring pipeline'),
  ('neon-db', 'Neon PostgreSQL', 'Database', 'active', NULL, '{"tables": ["screened_jobs", "ghost_signals", "job_applications", "sweep_runs", "seen_jobs"]}', 'Primary job data store'),
  ('apify', 'Apify', 'Scraping', 'active', 'https://api.apify.com/v2', '{"actors": ["indeed-scraper", "linkedin-jobs-scraper"]}', 'LinkedIn and Indeed job scrapers'),
  ('exa', 'Exa Search', 'AI Search', 'active', 'https://api.exa.ai', '{"role": "Semantic web search"}', 'AI-powered web search for research'),
  ('n8n', 'n8n Workflow', 'Automation', 'active', 'http://localhost:5678', '{"workflow": "ghost-sweep-1", "schedule": "Monday 8am"}', 'Orchestrates Ghost Sweep pipeline on schedule'),
  ('ruflo', 'Ruflo Token Optimizer', 'Infrastructure', 'active', NULL, '{"version": "3.5.48", "tiers": ["WASM <1ms", "Haiku ~500ms", "Sonnet/Opus 2-5s"], "intelligence_files": 84}', '3-tier model routing for token optimization'),
  ('github', 'GitHub', 'Version Control', 'active', 'https://api.github.com', '{"username": "jashshah854-a11y", "repos": ["ghost-sweep-server", "JobCommandCenter"]}', 'Code hosting and CI/CD'),
  ('gmail-primary', 'Gmail (Primary)', 'Email', 'active', NULL, '{"email": "jashshah854@gmail.com", "use": "Job applications, primary"}', 'Primary email for job applications'),
  ('gmail-secondary', 'Gmail (Secondary)', 'Email', 'available', NULL, '{"email": "jashisgreat19@gmail.com", "use": "Personal, NO job emails"}', 'Personal email only'),
  ('pace-email', 'Pace University Email', 'Email', 'available', NULL, '{"email": "js72092n@pace.edu", "use": "University communications"}', 'University email');
