-- Keep user_subscriptions.user_email in sync with auth.users.email
CREATE OR REPLACE FUNCTION public.set_user_subscription_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
  auth_email text;
BEGIN
  IF NEW.user_email IS NULL OR btrim(NEW.user_email) = '' THEN
    SELECT u.email INTO auth_email
    FROM auth.users u
    WHERE u.id = NEW.user_id;
    IF auth_email IS NOT NULL THEN
      NEW.user_email := auth_email;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_subscriptions_set_email ON public.user_subscriptions;
CREATE TRIGGER trg_user_subscriptions_set_email
  BEFORE INSERT OR UPDATE ON public.user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_user_subscription_email();

-- Backfill existing rows
UPDATE public.user_subscriptions s
SET user_email = u.email,
    updated_at = now()
FROM auth.users u
WHERE s.user_id = u.id
  AND u.email IS NOT NULL
  AND (s.user_email IS NULL OR btrim(s.user_email) = '');
