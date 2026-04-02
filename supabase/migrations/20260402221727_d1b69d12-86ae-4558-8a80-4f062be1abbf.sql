
CREATE TABLE public.task_outputs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL,
  output_type TEXT NOT NULL DEFAULT 'report',
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  format TEXT NOT NULL DEFAULT 'markdown',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.task_outputs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read task_outputs" ON public.task_outputs FOR SELECT USING (true);
CREATE POLICY "Public insert task_outputs" ON public.task_outputs FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update task_outputs" ON public.task_outputs FOR UPDATE USING (true);

CREATE INDEX idx_task_outputs_task_id ON public.task_outputs (task_id);
