
-- Add new columns to inbox
ALTER TABLE public.inbox ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'unread';
ALTER TABLE public.inbox ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.inbox ADD COLUMN IF NOT EXISTS feedback text DEFAULT NULL;

-- Drop existing DELETE-only policy and add full CRUD
DROP POLICY IF EXISTS "Public delete inbox" ON public.inbox;

CREATE POLICY "Public read inbox" ON public.inbox FOR SELECT USING (true);
CREATE POLICY "Public insert inbox" ON public.inbox FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update inbox" ON public.inbox FOR UPDATE USING (true);
CREATE POLICY "Public delete inbox" ON public.inbox FOR DELETE USING (true);
