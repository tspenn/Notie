/**
 * fetch-ics-trial — ICS proxy for Notie free-trial users (no account required).
 * Trusted calendar hosts only (Google, Apple, Microsoft, Canvas). No custom allowlist.
 */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, X-Client-Info, Apikey, x-app-key, X-Notie-Trial-Id',
};

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 10;
const FETCH_TIMEOUT_MS = 12_000;
const MAX_ICS_BYTES = 1_000_000;

const trialRequestWindow = new Map<string, { count: number; startedAt: number }>();

const TRUSTED_CALENDAR_HOSTS = [
  'calendar.google.com',
  'accounts.google.com',
  'apidata.googleusercontent.com',
  'calendar.live.com',
  'outlook.office.com',
  'outlook.office365.com',
  'outlook.live.com',
  'graph.microsoft.com',
  'icloud.com',
  'caldav.icloud.com',
  'canvas.instructure.com',
];

function normalizeHost(host: string): string {
  return host.toLowerCase().replace(/\.$/, '');
}

function isHostAllowed(host: string, patterns: string[]): boolean {
  const normalizedHost = normalizeHost(host);
  return patterns.some((rawPattern) => {
    const pattern = normalizeHost(rawPattern.trim());
    if (!pattern) return false;
    if (pattern.startsWith('*.')) {
      const suffix = pattern.slice(2);
      return normalizedHost === suffix || normalizedHost.endsWith(`.${suffix}`);
    }
    return normalizedHost === pattern;
  });
}

function isRateLimited(trialId: string): boolean {
  const now = Date.now();
  const window = trialRequestWindow.get(trialId);
  if (!window || now - window.startedAt >= RATE_LIMIT_WINDOW_MS) {
    trialRequestWindow.set(trialId, { count: 1, startedAt: now });
    return false;
  }
  if (window.count >= RATE_LIMIT_MAX_REQUESTS) return true;
  window.count += 1;
  trialRequestWindow.set(trialId, window);
  return false;
}

function getExtraAllowedHostsFromEnv(): string[] {
  const raw = Deno.env.get('FETCH_ICS_ALLOWED_HOSTS') ?? '';
  return raw
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apikey = req.headers.get('Apikey') ?? '';
    const authHeader = req.headers.get('Authorization') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!anonKey || (apikey !== anonKey && token !== anonKey)) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const trialId = req.headers.get('X-Notie-Trial-Id')?.trim();
    if (!trialId || trialId.length > 128) {
      return json({ error: 'Missing trial id' }, 400);
    }

    if (isRateLimited(trialId)) {
      return json({ error: 'Rate limit exceeded. Try again shortly.' }, 429);
    }

    let icsUrl: string | null = new URL(req.url).searchParams.get('url');
    if (!icsUrl && req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      icsUrl = typeof body.url === 'string' ? body.url : null;
    }
    if (!icsUrl) return json({ error: 'Missing url parameter' }, 400);

    const parsedUrl = new URL(icsUrl);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return json({ error: 'Invalid URL protocol' }, 400);
    }

    const allowedHostPatterns = [...TRUSTED_CALENDAR_HOSTS, ...getExtraAllowedHostsFromEnv()];
    if (!isHostAllowed(parsedUrl.hostname, allowedHostPatterns)) {
      return json(
        {
          error:
            'That calendar host is not available on the free trial. Google, Apple, and Outlook work — sign up to connect school or work calendars.',
        },
        403,
      );
    }

    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), FETCH_TIMEOUT_MS);
    let icsResponse: Response;
    try {
      icsResponse = await fetch(icsUrl, {
        headers: { 'User-Agent': 'Notie/1.0 (trial calendar sync)' },
        signal: abortController.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!icsResponse.ok) {
      return json({ error: `Failed to fetch calendar: HTTP ${icsResponse.status}` }, 502);
    }

    const reportedLength = Number(icsResponse.headers.get('content-length') ?? '0');
    if (reportedLength && reportedLength > MAX_ICS_BYTES) {
      return json({ error: 'ICS file is too large' }, 413);
    }

    const icsText = await icsResponse.text();
    if (new TextEncoder().encode(icsText).byteLength > MAX_ICS_BYTES) {
      return json({ error: 'ICS file is too large' }, 413);
    }

    if (!icsText.includes('BEGIN:VCALENDAR')) {
      return json({ error: 'URL does not appear to be a valid ICS/iCalendar feed' }, 422);
    }

    return json({ ics: icsText });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return json({ error: 'Calendar source timed out' }, 504);
    }
    console.error('fetch-ics-trial error:', err);
    return json({ error: 'Internal server error' }, 500);
  }
});

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
