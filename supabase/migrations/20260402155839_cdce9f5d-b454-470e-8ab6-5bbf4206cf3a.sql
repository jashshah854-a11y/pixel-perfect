
CREATE TABLE public.task_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid NOT NULL,
  agent_id text NOT NULL,
  role text NOT NULL DEFAULT 'observer',
  fit_score integer NOT NULL DEFAULT 0,
  reasoning text,
  claimed_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.task_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access for task_assignments"
ON public.task_assignments FOR SELECT USING (true);

CREATE POLICY "Public insert access for task_assignments"
ON public.task_assignments FOR INSERT WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.task_assignments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
