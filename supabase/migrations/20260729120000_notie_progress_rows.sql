-- Progress ledger for Library Growth bars (synced on trial + Sync)
CREATE TABLE IF NOT EXISTS public.notie_progress_rows (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notebook_id uuid NOT NULL REFERENCES public.notie_notebooks(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  summary text NOT NULL DEFAULT '',
  inspiration text NOT NULL DEFAULT '',
  investment_minutes int NOT NULL DEFAULT 0,
  entry_id uuid REFERENCES public.notie_entries(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notie_progress_rows_user_idx
  ON public.notie_progress_rows (user_id, notebook_id);

ALTER TABLE public.notie_progress_rows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notie_progress_rows_all" ON public.notie_progress_rows;
CREATE POLICY "notie_progress_rows_all" ON public.notie_progress_rows
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
