
-- System suggestions table
CREATE TABLE public.system_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'next_task',
  title text NOT NULL,
  description text NOT NULL,
  confidence real NOT NULL DEFAULT 0.5,
  status text NOT NULL DEFAULT 'pending',
  affected_agents text[] DEFAULT '{}'::text[],
  acted_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.system_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read system_suggestions" ON public.system_suggestions FOR SELECT USING (true);
CREATE POLICY "Public insert system_suggestions" ON public.system_suggestions FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update system_suggestions" ON public.system_suggestions FOR UPDATE USING (true);

-- Autonomous actions table
CREATE TABLE public.autonomous_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type text NOT NULL,
  description text NOT NULL,
  agent_id text,
  task_id uuid,
  approved boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.autonomous_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read autonomous_actions" ON public.autonomous_actions FOR SELECT USING (true);
CREATE POLICY "Public insert autonomous_actions" ON public.autonomous_actions FOR INSERT WITH CHECK (true);

-- External actions table
CREATE TABLE public.external_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id text NOT NULL,
  task_id uuid,
  action_type text NOT NULL,
  target text,
  payload jsonb DEFAULT '{}'::jsonb,
  result jsonb,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.external_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read external_actions" ON public.external_actions FOR SELECT USING (true);
CREATE POLICY "Public insert external_actions" ON public.external_actions FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update external_actions" ON public.external_actions FOR UPDATE USING (true);
