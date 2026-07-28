-- Extra fields needed for Sync plan cloud sync of entries.
ALTER TABLE public.notie_entries
  ADD COLUMN IF NOT EXISTS inspiration text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS writing_minutes int NOT NULL DEFAULT 0;
