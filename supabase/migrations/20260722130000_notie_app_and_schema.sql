-- Notie on the shared Friday Canvas / Skyland Supabase project.
-- Scoped by app_key = 'notie'. Edge functions/webhooks stay separate (stripe-webhook-notie, etc.).

INSERT INTO public.apps (app_key, name)
VALUES ('notie', 'Notie')
ON CONFLICT (app_key) DO NOTHING;

-- Pricing tiers (no AI credits). Prices are dollars, matching other Skyland apps.
INSERT INTO public.subscription_tiers (name, price_monthly, price_yearly, credits_included, has_ai_access, features, app_key)
SELECT v.name, v.price_monthly, v.price_yearly, 0, false, v.features, 'notie'
FROM (
  VALUES
    (
      'One Device',
      0::numeric,
      9.99::numeric,
      jsonb_build_object(
        'key', 'one_device',
        'price_one_time', 9.99,
        'sync', false,
        'blurb', 'Local on one device. No multi-device sync.'
      )
    ),
    (
      'Cloud Sync',
      3.99::numeric,
      39.99::numeric,
      jsonb_build_object(
        'key', 'cloud_sync',
        'price_monthly', 3.99,
        'price_yearly', 39.99,
        'sync', true,
        'blurb', 'Sync across your devices.'
      )
    )
) AS v(name, price_monthly, price_yearly, features)
WHERE NOT EXISTS (
  SELECT 1 FROM public.subscription_tiers t
  WHERE t.app_key = 'notie' AND t.name = v.name
);

-- Stripe price IDs (My Notie products)
UPDATE public.subscription_tiers
SET
  stripe_price_id_monthly = 'price_1Tw0A8IVCtEWvFGCKEYNQ3o7',
  stripe_price_id_yearly = 'price_1Tw0CSIVCtEWvFGCFtjn5W5X',
  features = COALESCE(features, '{}'::jsonb) || jsonb_build_object(
    'product', 'My Notie - Sync',
    'stripe_price_id_monthly', 'price_1Tw0A8IVCtEWvFGCKEYNQ3o7',
    'stripe_price_id_yearly', 'price_1Tw0CSIVCtEWvFGCFtjn5W5X'
  )
WHERE app_key = 'notie' AND name = 'Cloud Sync';

UPDATE public.subscription_tiers
SET
  stripe_price_id_yearly = 'price_1Tw00zIVCtEWvFGCciJs6dr8',
  features = COALESCE(features, '{}'::jsonb) || jsonb_build_object(
    'product', 'Download',
    'mode', 'payment',
    'stripe_price_id_one_time', 'price_1Tw00zIVCtEWvFGCciJs6dr8'
  )
WHERE app_key = 'notie' AND name = 'One Device';

-- Notebooks (Library books)
CREATE TABLE IF NOT EXISTS public.notie_notebooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  inspiration text NOT NULL DEFAULT '',
  color_index int NOT NULL DEFAULT 0,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notie_notebooks_user_idx
  ON public.notie_notebooks (user_id, is_archived);

ALTER TABLE public.notie_notebooks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notie_notebooks_select" ON public.notie_notebooks;
CREATE POLICY "notie_notebooks_select" ON public.notie_notebooks
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notie_notebooks_insert" ON public.notie_notebooks;
CREATE POLICY "notie_notebooks_insert" ON public.notie_notebooks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notie_notebooks_update" ON public.notie_notebooks;
CREATE POLICY "notie_notebooks_update" ON public.notie_notebooks
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notie_notebooks_delete" ON public.notie_notebooks;
CREATE POLICY "notie_notebooks_delete" ON public.notie_notebooks
  FOR DELETE USING (auth.uid() = user_id);

-- Entries (renamed from Sessions)
CREATE TABLE IF NOT EXISTS public.notie_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notebook_id uuid NOT NULL REFERENCES public.notie_notebooks(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Untitled entry',
  content text NOT NULL DEFAULT '',
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notie_entries_notebook_idx
  ON public.notie_entries (notebook_id, is_archived, updated_at DESC);

CREATE INDEX IF NOT EXISTS notie_entries_user_idx
  ON public.notie_entries (user_id);

ALTER TABLE public.notie_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notie_entries_select" ON public.notie_entries;
CREATE POLICY "notie_entries_select" ON public.notie_entries
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notie_entries_insert" ON public.notie_entries;
CREATE POLICY "notie_entries_insert" ON public.notie_entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notie_entries_update" ON public.notie_entries;
CREATE POLICY "notie_entries_update" ON public.notie_entries
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notie_entries_delete" ON public.notie_entries;
CREATE POLICY "notie_entries_delete" ON public.notie_entries
  FOR DELETE USING (auth.uid() = user_id);

-- Categories / saved items
CREATE TABLE IF NOT EXISTS public.notie_saved_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notebook_id uuid NOT NULL REFERENCES public.notie_notebooks(id) ON DELETE CASCADE,
  entry_id uuid REFERENCES public.notie_entries(id) ON DELETE SET NULL,
  category text NOT NULL,
  content text NOT NULL DEFAULT '',
  content_type text NOT NULL DEFAULT 'text'
    CHECK (content_type IN ('text', 'url', 'image', 'file')),
  content_data jsonb,
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notie_saved_items_notebook_idx
  ON public.notie_saved_items (notebook_id, category);

ALTER TABLE public.notie_saved_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notie_saved_items_select" ON public.notie_saved_items;
CREATE POLICY "notie_saved_items_select" ON public.notie_saved_items
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notie_saved_items_insert" ON public.notie_saved_items;
CREATE POLICY "notie_saved_items_insert" ON public.notie_saved_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notie_saved_items_update" ON public.notie_saved_items;
CREATE POLICY "notie_saved_items_update" ON public.notie_saved_items
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notie_saved_items_delete" ON public.notie_saved_items;
CREATE POLICY "notie_saved_items_delete" ON public.notie_saved_items
  FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.notie_custom_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notebook_id uuid NOT NULL REFERENCES public.notie_notebooks(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, notebook_id, name)
);

ALTER TABLE public.notie_custom_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notie_custom_categories_all" ON public.notie_custom_categories;
CREATE POLICY "notie_custom_categories_all" ON public.notie_custom_categories
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Calendar events (Notie-owned rows; may mirror shared calendar later)
CREATE TABLE IF NOT EXISTS public.notie_calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  notebook_id uuid REFERENCES public.notie_notebooks(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'notie'
    CHECK (source IN ('notie', 'ics', 'google', 'outlook')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notie_calendar_events_user_idx
  ON public.notie_calendar_events (user_id, start_time);

ALTER TABLE public.notie_calendar_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notie_calendar_events_all" ON public.notie_calendar_events;
CREATE POLICY "notie_calendar_events_all" ON public.notie_calendar_events
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Note to self (push reminders)
CREATE TABLE IF NOT EXISTS public.notie_notes_to_self (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  deliver_at timestamptz NOT NULL,
  delivered boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notie_notes_to_self_due_idx
  ON public.notie_notes_to_self (deliver_at)
  WHERE delivered = false;

ALTER TABLE public.notie_notes_to_self ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notie_notes_to_self_all" ON public.notie_notes_to_self;
CREATE POLICY "notie_notes_to_self_all" ON public.notie_notes_to_self
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Full-text helpers for global Library search
ALTER TABLE public.notie_entries
  ADD COLUMN IF NOT EXISTS search_tsv tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(regexp_replace(content, '<[^>]+>', ' ', 'g'), '')), 'B')
  ) STORED;

CREATE INDEX IF NOT EXISTS notie_entries_search_idx ON public.notie_entries USING GIN (search_tsv);

ALTER TABLE public.notie_saved_items
  ADD COLUMN IF NOT EXISTS search_tsv tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(category, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(content, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(content_data->>'filename', '')), 'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS notie_saved_items_search_idx ON public.notie_saved_items USING GIN (search_tsv);
