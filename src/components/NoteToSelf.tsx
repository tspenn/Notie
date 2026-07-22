import { useEffect, useMemo, useState } from 'react';
import { Bell, BellOff, Send, Trash2 } from 'lucide-react';

import { localDb } from '@/lib/localDb';
import type { NoteToSelf as NoteToSelfType } from '@/lib/types';
import { formatShortDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface NoteToSelfProps {
  userId: string;
}

function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * "Note to self" — a short message the writer schedules for later delivery.
 * Real push delivery requires a registered service worker + subscription and
 * (for cloud accounts) a Supabase edge function/cron to fire at deliverAt —
 * see supabase/migrations/20260722130000_notie_app_and_schema.sql
 * (public.notie_notes_to_self) and public/push-sw.js for the client-side
 * handler. This view schedules the row locally and, when the tab stays open
 * and permission is granted, shows a best-effort local notification.
 */
export function NoteToSelf({ userId }: NoteToSelfProps) {
  const [notes, setNotes] = useState<NoteToSelfType[]>([]);
  const [body, setBody] = useState('');
  const [deliverAt, setDeliverAt] = useState(() => toDatetimeLocal(new Date(Date.now() + 60 * 60 * 1000)));
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied',
  );

  const refresh = () => setNotes(localDb.listNotesToSelf(userId));

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Best-effort local delivery while this tab stays open.
  useEffect(() => {
    const id = window.setInterval(() => {
      const due = localDb.listNotesToSelf(userId).filter((n) => !n.delivered && new Date(n.deliverAt) <= new Date());
      due.forEach((n) => {
        localDb.markNoteDelivered(n.id);
        if (permission === 'granted') {
          new Notification('Note to self', { body: n.body, icon: '/favicon.svg' });
        }
      });
      if (due.length) refresh();
    }, 30_000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, permission]);

  const upcoming = useMemo(() => notes.filter((n) => !n.delivered), [notes]);
  const past = useMemo(() => notes.filter((n) => n.delivered), [notes]);

  const requestPermission = async () => {
    if (typeof Notification === 'undefined') return;
    const result = await Notification.requestPermission();
    setPermission(result);
  };

  const addNote = () => {
    const text = body.trim();
    if (!text) return;
    localDb.addNoteToSelf(userId, text, new Date(deliverAt).toISOString());
    setBody('');
    refresh();
  };

  const removeNote = (id: string) => {
    // Notes are simple local rows; deleting is just filtering them out on read,
    // so we mark as delivered to remove from the "upcoming" list.
    localDb.markNoteDelivered(id);
    refresh();
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-2xl font-semibold text-foreground">Note to self</h2>
        <p className="text-sm text-muted-foreground">Leave a message for later — a nudge, a reminder, a thought.</p>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-border bg-secondary/30 px-3.5 py-3 text-sm text-muted-foreground">
        {permission === 'granted' ? (
          <Bell className="mt-0.5 h-4 w-4 shrink-0 text-moss" />
        ) : (
          <BellOff className="mt-0.5 h-4 w-4 shrink-0" />
        )}
        <div className="flex-1">
          <p>Must have notifications enabled on your device/s.</p>
          {permission !== 'granted' && (
            <Button size="sm" variant="outline" className="mt-2" onClick={requestPermission}>
              Enable notifications
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card/70 p-4 shadow-sm sm:p-5">
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Your note</Label>
            <Input
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Remember to revisit chapter three…"
            />
          </div>
          <div className="space-y-1">
            <Label>Deliver at</Label>
            <Input type="datetime-local" value={deliverAt} onChange={(e) => setDeliverAt(e.target.value)} />
          </div>
          <Button onClick={addNote} disabled={!body.trim()}>
            <Send className="mr-1.5 h-3.5 w-3.5" />
            Schedule note
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Upcoming</h3>
        {upcoming.length === 0 && <p className="text-sm text-muted-foreground">No notes scheduled.</p>}
        {upcoming.map((n) => (
          <div
            key={n.id}
            className="flex items-start justify-between gap-3 rounded-lg border border-border/70 bg-card px-3.5 py-2.5"
          >
            <div>
              <p className="text-sm text-foreground">{n.body}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{formatShortDate(n.deliverAt)}</p>
            </div>
            <button
              type="button"
              onClick={() => removeNote(n.id)}
              className="shrink-0 text-muted-foreground hover:text-destructive"
              aria-label="Remove note"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {past.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Delivered</h3>
          {past.map((n) => (
            <div key={n.id} className="rounded-lg border border-border/50 bg-secondary/20 px-3.5 py-2.5 opacity-70">
              <p className="text-sm text-foreground">{n.body}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{formatShortDate(n.deliverAt)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
