
-- Agent persistent memory / learning store
CREATE TABLE public.agent_memory (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id text NOT NULL,
  memory_type text NOT NULL DEFAULT 'pattern',
  content text NOT NULL,
  source_task_id uuid,
  confidence real NOT NULL DEFAULT 0.5,
  tags text[] DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read agent_memory" ON public.agent_memory FOR SELECT USING (true);
CREATE POLICY "Public insert agent_memory" ON public.agent_memory FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update agent_memory" ON public.agent_memory FOR UPDATE USING (true);

CREATE INDEX idx_agent_memory_agent ON public.agent_memory(agent_id);
CREATE INDEX idx_agent_memory_type ON public.agent_memory(memory_type);

-- Cross-agent collaboration log
CREATE TABLE public.agent_collaborations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid,
  from_agent text NOT NULL,
  to_agent text NOT NULL,
  collab_type text NOT NULL DEFAULT 'share_finding',
  message text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  resolved_at timestamp with time zone
);

ALTER TABLE public.agent_collaborations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read agent_collaborations" ON public.agent_collaborations FOR SELECT USING (true);
CREATE POLICY "Public insert agent_collaborations" ON public.agent_collaborations FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update agent_collaborations" ON public.agent_collaborations FOR UPDATE USING (true);

CREATE INDEX idx_collab_task ON public.agent_collaborations(task_id);
CREATE INDEX idx_collab_agents ON public.agent_collaborations(from_agent, to_agent);

ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_collaborations;

-- Autonomous research log
CREATE TABLE public.agent_research_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id text NOT NULL,
  topic text NOT NULL,
  findings text,
  source_url text,
  relevance_score real NOT NULL DEFAULT 0.5,
  applied boolean NOT NULL DEFAULT false,
  researched_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_research_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read agent_research_log" ON public.agent_research_log FOR SELECT USING (true);
CREATE POLICY "Public insert agent_research_log" ON public.agent_research_log FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update agent_research_log" ON public.agent_research_log FOR UPDATE USING (true);

CREATE INDEX idx_research_agent ON public.agent_research_log(agent_id);
