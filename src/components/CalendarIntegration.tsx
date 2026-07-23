import { useEffect, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, Link2, RefreshCw, X } from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/contexts/AuthContext';
import { fetchIcsText, resolveCalendarAuthUser } from '@/lib/calendarFetch';
import { localDb } from '@/lib/localDb';
import { supabase } from '@/lib/supabase';
import {
  LOOKAHEAD_DAYS,
  LOOKBACK_DAYS,
  extractHost,
  normalizeCalendarUrl,
  parseIcs,
} from '@/lib/icsParser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export const NOTIE_CALENDAR_SYNC_EVENT = 'notie:calendar-sync-complete';

function IcsCalendarCard({ userId }: { userId: string }) {
  const { mode, user } = useAuth();
  const [savedUrl, setSavedUrl] = useState('');
  const [inputUrl, setInputUrl] = useState('');
  const [showReconnectForm, setShowReconnectForm] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncMessageKind, setSyncMessageKind] = useState<'neutral' | 'success' | 'error'>('neutral');
  const [allowingHost, setAllowingHost] = useState(false);
  const [blockedHost, setBlockedHost] = useState<string | null>(null);
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cached = localDb.getIcsSettings(userId);
    if (cached?.feedUrl) {
      setSavedUrl(cached.feedUrl);
      setInputUrl(cached.feedUrl);
      setLastSynced(cached.lastSynced);
    }
    setLoading(false);
  }, [userId]);

  const saveUrl = () => {
    const normalized = normalizeCalendarUrl(inputUrl);
    if (!normalized) {
      toast.error('Please paste a valid calendar URL');
      setSyncMessage('Please paste a valid calendar URL');
      setSyncMessageKind('error');
      return;
    }
    localDb.setIcsSettings(userId, { feedUrl: normalized, lastSynced });
    setSavedUrl(normalized);
    setInputUrl(normalized);
    setShowReconnectForm(false);
    setSyncMessage('Calendar link saved. Click Sync now to import events.');
    setSyncMessageKind('neutral');
    toast.success('Calendar URL saved');
  };

  const allowCurrentHost = async () => {
    const host = extractHost(savedUrl || inputUrl);
    if (!host) {
      toast.error('Paste a valid calendar URL first');
      return;
    }

    const calendarUser = user ?? (await resolveCalendarAuthUser());
    if (!calendarUser) {
      toast.message('Create a free account to allow school or work calendar hosts.');
      return;
    }

    setAllowingHost(true);
    try {
      const { data: existing } = await supabase
        .from('user_calendar_domain_allowlist')
        .select('id, is_active')
        .eq('user_id', calendarUser.id)
        .ilike('host_pattern', host)
        .maybeSingle();

      if (existing?.id) {
        if (!existing.is_active) {
          const { error } = await supabase
            .from('user_calendar_domain_allowlist')
            .update({ is_active: true, updated_at: new Date().toISOString() })
            .eq('id', existing.id)
            .eq('user_id', calendarUser.id);
          if (error) throw error;
        }
      } else {
        const { error } = await supabase.from('user_calendar_domain_allowlist').insert({
          user_id: calendarUser.id,
          host_pattern: host,
          is_active: true,
        });
        if (error) throw error;
      }

      setBlockedHost(null);
      toast.success(`Allowed ${host}. Syncing now…`);
      await syncNow();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not allow this source');
    } finally {
      setAllowingHost(false);
    }
  };

  const syncNow = async () => {
    const urlToSync = normalizeCalendarUrl(savedUrl || inputUrl.trim());
    if (!urlToSync) {
      toast.error('Paste your calendar URL first');
      setSyncMessage('Paste a valid calendar URL first.');
      setSyncMessageKind('error');
      return;
    }

    setSyncing(true);
    setSyncMessage('Syncing calendar…');
    setSyncMessageKind('neutral');

    try {
      let accessToken: string | null = null;
      if (mode === 'cloud' && user && !user.is_anonymous) {
        const { data } = await supabase.auth.getSession();
        accessToken = data.session?.access_token ?? null;
      }

      const fetched = await fetchIcsText(urlToSync, {
        accessToken,
        trialUserId: mode === 'local' || user?.is_anonymous ? userId : null,
      });

      if (!fetched.ok) {
        if (fetched.status === 403) {
          const host = extractHost(urlToSync);
          if (host) setBlockedHost(host);
          setShowTroubleshooting(true);
          throw new Error(
            fetched.error ||
              'That calendar source is not trusted yet. Allow the host below, then sync again.',
          );
        }
        throw new Error(fetched.error);
      }

      const icsText = fetched.ics;

      const events = parseIcs(icsText);
      const now = new Date();
      const minDate = new Date(now);
      minDate.setDate(minDate.getDate() - LOOKBACK_DAYS);
      const maxDate = new Date(now);
      maxDate.setDate(maxDate.getDate() + LOOKAHEAD_DAYS);

      const bounded = events.filter((e) => e.end >= minDate && e.start <= maxDate);
      if (bounded.length === 0) {
        const msg =
          events.length === 0
            ? 'No events found in this calendar feed.'
            : `No events in the current window (${LOOKBACK_DAYS} days back, ~${Math.round(LOOKAHEAD_DAYS / 365)} years ahead).`;
        setSyncMessage(msg);
        setSyncMessageKind('neutral');
        toast.message(msg);
        window.dispatchEvent(
          new CustomEvent(NOTIE_CALENDAR_SYNC_EVENT, { detail: { eventCount: 0 } }),
        );
        return;
      }

      const uidCounts = new Map<string, number>();
      const rows = bounded.map((e) => {
        const seen = uidCounts.get(e.uid) ?? 0;
        uidCounts.set(e.uid, seen + 1);
        const externalId = seen === 0 ? e.uid : `${e.uid}::${e.start.toISOString()}`;
        return {
          externalId,
          title: e.title,
          description: [e.description, e.location].filter(Boolean).join('\n') || undefined,
          startTime: e.start.toISOString(),
          endTime: e.end.toISOString(),
        };
      });

      const count = localDb.replaceIcsEvents(userId, rows);
      const nowIso = new Date().toISOString();
      localDb.setIcsSettings(userId, { feedUrl: urlToSync, lastSynced: nowIso });
      setSavedUrl(urlToSync);
      setLastSynced(nowIso);
      setBlockedHost(null);
      setShowHelp(false);
      setShowTroubleshooting(false);
      setShowReconnectForm(false);
      setSyncMessage(`Imported ${count} current/upcoming events.`);
      setSyncMessageKind('success');
      window.dispatchEvent(
        new CustomEvent(NOTIE_CALENDAR_SYNC_EVENT, { detail: { eventCount: count } }),
      );
      toast.success(`Synced ${count} events from your calendar`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Sync failed';
      setSyncMessage(msg);
      setSyncMessageKind('error');
      toast.error(msg);
    } finally {
      setSyncing(false);
    }
  };

  if (loading) return null;

  const isConnected = !!savedUrl;
  const showForm = !isConnected || showReconnectForm;
  const connectedHost = savedUrl ? extractHost(savedUrl) : null;

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card/80 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-moss/15 text-moss">
            <Link2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold text-foreground">
              Connect your calendar
            </h3>
            <p className="text-xs text-muted-foreground">
              Google, Outlook, Apple, and any ICS / iCal feed — read-only
            </p>
          </div>
        </div>
        {savedUrl && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-moss/30 bg-moss/10 px-2 py-0.5 text-xs text-moss">
            <CheckCircle2 className="h-3 w-3" />
            Connected
          </span>
        )}
      </div>

      {showForm ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            placeholder="Paste your calendar’s ICS / webcal URL here…"
            className="flex-1 text-xs"
          />
          <Button
            size="sm"
            variant="secondary"
            onClick={saveUrl}
            disabled={!inputUrl.trim() || inputUrl.trim() === savedUrl}
          >
            Save URL
          </Button>
          <Button size="sm" onClick={() => void syncNow()} disabled={syncing}>
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing…' : 'Sync now'}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-stretch justify-between gap-2 rounded-lg border border-moss/25 bg-moss/5 px-3 py-2.5 sm:flex-row sm:items-center">
          <p className="truncate text-xs text-foreground">
            Connected source:{' '}
            <span className="font-medium">{connectedHost || 'Saved calendar source'}</span>
          </p>
          <Button size="sm" onClick={() => void syncNow()} disabled={syncing}>
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing…' : 'Sync now'}
          </Button>
        </div>
      )}

      {(showTroubleshooting || blockedHost) && (
        <div className="space-y-2 rounded-lg border border-border bg-background/70 p-3">
          <p className="text-xs text-foreground">Having trouble with a calendar link?</p>
          {blockedHost ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                Notie blocked <span className="text-foreground">{blockedHost}</span> for safety
                (school/work hosts need a one-time allow).
              </p>
              <Button size="sm" variant="secondary" disabled={allowingHost} onClick={() => void allowCurrentHost()}>
                {allowingHost ? 'Allowing…' : 'Allow this source'}
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              If your calendar is from a school or company domain, paste the link and sync once. We
              will offer one-click approval if needed.
            </p>
          )}
        </div>
      )}

      {syncMessage && (
        <p
          className={`text-xs ${
            syncMessageKind === 'success'
              ? 'text-moss'
              : syncMessageKind === 'error'
                ? 'text-destructive'
                : 'text-muted-foreground'
          }`}
        >
          {syncMessage}
        </p>
      )}

      {lastSynced && (
        <p className="text-xs text-muted-foreground">
          Last synced: {new Date(lastSynced).toLocaleString()}
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        Notie never writes back to your calendar. Events are pulled in for reference only.
      </p>

      {!showTroubleshooting && !blockedHost && (
        <button
          type="button"
          onClick={() => setShowTroubleshooting(true)}
          className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          Having trouble with a calendar link?
        </button>
      )}

      <button
        type="button"
        onClick={() => setShowHelp((h) => !h)}
        className="flex items-center gap-1.5 text-xs font-medium text-moss hover:underline"
      >
        {showHelp ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        How to get my ICS link
      </button>

      {showHelp && (
        <div className="space-y-3 rounded-lg border border-border bg-background/70 p-4 text-xs leading-relaxed text-muted-foreground">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setShowHelp(false)}
              className="inline-flex items-center gap-1 text-[11px] hover:text-foreground"
            >
              <X className="h-3 w-3" />
              Close
            </button>
          </div>
          <div className="space-y-1">
            <p className="font-medium text-foreground">Google Calendar</p>
            <ol className="list-decimal space-y-1 pl-4">
              <li>
                Open{' '}
                <a
                  href="https://calendar.google.com"
                  target="_blank"
                  rel="noreferrer"
                  className="text-moss underline"
                >
                  calendar.google.com
                </a>{' '}
                on a computer
              </li>
              <li>
                Find your calendar in the left sidebar → click the <span className="text-foreground">⋮</span>{' '}
                menu → <span className="text-foreground">Settings and sharing</span>
              </li>
              <li>
                Click <span className="text-foreground">Integrate calendar</span>
              </li>
              <li>
                Copy the <span className="text-foreground">Secret address in iCal format</span>
              </li>
              <li>Paste that URL above and tap Sync now</li>
            </ol>
          </div>
          <div className="space-y-1">
            <p className="font-medium text-foreground">Apple Calendar (iCloud)</p>
            <ol className="list-decimal space-y-1 pl-4">
              <li>Open iCloud.com → Calendar</li>
              <li>
                Share icon next to your calendar → enable{' '}
                <span className="text-foreground">Public Calendar</span>
              </li>
              <li>
                Copy the <span className="font-mono text-foreground">webcal://</span> link — change it
                to <span className="font-mono text-foreground">https://</span> before pasting
              </li>
            </ol>
          </div>
          <div className="space-y-1">
            <p className="font-medium text-foreground">Outlook / Microsoft 365</p>
            <ol className="list-decimal space-y-1 pl-4">
              <li>
                Go to{' '}
                <a
                  href="https://outlook.live.com/calendar"
                  target="_blank"
                  rel="noreferrer"
                  className="text-moss underline"
                >
                  Outlook Calendar
                </a>
              </li>
              <li>Settings → View all Outlook settings → Calendar → Shared calendars</li>
              <li>
                Under <span className="text-foreground">Publish a calendar</span>, choose{' '}
                <span className="text-foreground">ICS</span> → Copy the link
              </li>
            </ol>
          </div>
          <p className="border-t border-border pt-2 text-muted-foreground">
            Your private ICS URL acts as a password — only share it with apps you trust. Notie fetches
            it server-side; it is never exposed publicly.
          </p>
          <p className="text-xs text-muted-foreground">
            Google, Apple, and Outlook calendars work on the free trial. School or work hosts may
            need a free account.
          </p>
        </div>
      )}

      <div className="flex justify-end border-t border-border pt-3">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setShowReconnectForm(true);
            setShowHelp(false);
          }}
        >
          Connect / reconnect calendar
        </Button>
      </div>
    </div>
  );
}

export function CalendarIntegration() {
  const { userId } = useAuth();
  if (!userId) return null;
  return <IcsCalendarCard userId={userId} />;
}
