import { supabase, isSupabaseConfigured, APP_KEY } from '@/lib/supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  '';

type FetchIcsResult =
  | { ok: true; ics: string }
  | { ok: false; status?: number; error: string };

function edgeHeaders(token: string, trialUserId?: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'x-app-key': APP_KEY,
  };
  if (trialUserId) headers['X-Notie-Trial-Id'] = trialUserId;
  return headers;
}

async function parseIcsResponse(res: Response): Promise<FetchIcsResult> {
  const json = (await res.json().catch(() => ({}))) as { ics?: string; error?: string };
  if (!res.ok) {
    return { ok: false, status: res.status, error: json.error || 'Fetch failed' };
  }
  if (!json.ics) return { ok: false, error: 'Empty calendar feed' };
  return { ok: true, ics: json.ics };
}

/** Lightweight auth so free-trial users can sync via the shared fetch-ics proxy. */
export async function ensureCalendarSession(): Promise<string | null> {
  if (!isSupabaseConfigured) return null;

  const { data: existing } = await supabase.auth.getSession();
  if (existing.session?.access_token) return existing.session.access_token;

  const { error } = await supabase.auth.signInAnonymously();
  if (error) return null;

  const { data: created } = await supabase.auth.getSession();
  return created.session?.access_token ?? null;
}

/** Resolve the Supabase user backing calendar allowlist actions (signed-in or anonymous trial). */
export async function resolveCalendarAuthUser() {
  if (!isSupabaseConfigured) return null;
  const token = await ensureCalendarSession();
  if (!token) return null;
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

/**
 * Fetch ICS text server-side when possible (CORS-safe).
 * Trial/local users: anonymous session → fetch-ics-trial (trusted hosts only) → direct fetch.
 */
export async function fetchIcsText(
  url: string,
  options: { accessToken?: string | null; trialUserId?: string | null } = {},
): Promise<FetchIcsResult> {
  const trialUserId = options.trialUserId ?? null;
  let accessToken = options.accessToken ?? null;

  if (!accessToken && isSupabaseConfigured) {
    accessToken = await ensureCalendarSession();
  }

  if (accessToken && supabaseUrl) {
    const res = await fetch(
      `${supabaseUrl}/functions/v1/fetch-ics?url=${encodeURIComponent(url)}`,
      { headers: edgeHeaders(accessToken) },
    );
    const primary = await parseIcsResponse(res);
    if (primary.ok || primary.status !== 401) return primary;
  }

  if (trialUserId && supabaseUrl && supabaseKey) {
    const res = await fetch(
      `${supabaseUrl}/functions/v1/fetch-ics-trial?url=${encodeURIComponent(url)}`,
      { headers: edgeHeaders(supabaseKey, trialUserId) },
    );
    const trial = await parseIcsResponse(res);
    if (trial.ok || trial.status !== 404) return trial;
  }

  try {
    const res = await fetch(url);
    if (!res.ok) {
      return { ok: false, status: res.status, error: `Could not download calendar (${res.status})` };
    }
    return { ok: true, ics: await res.text() };
  } catch {
    return {
      ok: false,
      error:
        'Could not reach that calendar from this browser. Google, Apple, and Outlook links usually work during your free trial.',
    };
  }
}
