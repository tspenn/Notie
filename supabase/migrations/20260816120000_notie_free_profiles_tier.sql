-- Notie free tier on shared Skyland profiles.
-- signup_app = 'notie' → profiles.tier = 'notie_free' (UI label remains Free).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  signup_app text := coalesce(new.raw_user_meta_data->>'signup_app', '');
  initial_tier text := 'support';
begin
  if signup_app = 'secret-agent' then
    initial_tier := 'sa_free';
  elsif signup_app = 'goshop' then
    initial_tier := 'goshop_free';
  elsif signup_app = 'my-support-agent' then
    initial_tier := 'msa-trial';
  elsif signup_app = 'toc' then
    initial_tier := 'toc_free';
  elsif signup_app = 'friday_canvas' then
    initial_tier := 'trial-fc';
  elsif signup_app = 'notie' then
    initial_tier := 'notie_free';
  end if;

  insert into public.profiles (id, email, tier)
  values (new.id, new.email, initial_tier)
  on conflict (id) do nothing;

  return new;
end;
$$;
