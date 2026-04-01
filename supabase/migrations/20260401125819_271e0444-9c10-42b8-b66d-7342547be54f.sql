
-- Create agents table
CREATE TABLE public.agents (
  id text PRIMARY KEY,
  name text NOT NULL,
  department text NOT NULL,
  role text NOT NULL,
  status text NOT NULL DEFAULT 'idle',
  current_task text,
  tokens_used integer NOT NULL DEFAULT 0,
  last_active timestamptz DEFAULT now()
);

-- Create tasks table
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  assigned_to text REFERENCES public.agents(id),
  status text NOT NULL DEFAULT 'queued',
  priority text NOT NULL DEFAULT 'medium',
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

-- Create plans table
CREATE TABLE public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  markdown_content text,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create inbox table
CREATE TABLE public.inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_agent text REFERENCES public.agents(id),
  message text NOT NULL,
  type text NOT NULL DEFAULT 'update',
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create sweep_results table
CREATE TABLE public.sweep_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company text NOT NULL,
  job_title text NOT NULL,
  ghost_score integer NOT NULL DEFAULT 0,
  fit_score integer NOT NULL DEFAULT 1,
  verdict text NOT NULL DEFAULT 'skip',
  apply_url text,
  flags jsonb DEFAULT '[]'::jsonb,
  swept_at timestamptz NOT NULL DEFAULT now()
);

-- Disable RLS on all tables (single user, no auth)
ALTER TABLE public.agents DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.inbox DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sweep_results DISABLE ROW LEVEL SECURITY;
