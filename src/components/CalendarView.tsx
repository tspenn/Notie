import { useEffect, useMemo, useState } from 'react';
import { Calendar, momentLocalizer, type SlotInfo } from 'react-big-calendar';
import moment from 'moment';
import { HelpCircle, Trash2 } from 'lucide-react';
import 'react-big-calendar/lib/css/react-big-calendar.css';

import { localDb } from '@/lib/localDb';
import type { CalendarEvent } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { CalendarIntegration, NOTIE_CALENDAR_SYNC_EVENT } from '@/components/CalendarIntegration';
import { HowToUse } from '@/components/HowToUse';

interface CalendarViewProps {
  userId: string;
}

const localizer = momentLocalizer(moment);

interface RbcEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: CalendarEvent;
}

export function CalendarView({ userId }: CalendarViewProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [draftOpen, setDraftOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [draftStart, setDraftStart] = useState<Date>(new Date());
  const [draftEnd, setDraftEnd] = useState<Date>(new Date());
  const [selected, setSelected] = useState<CalendarEvent | null>(null);
  const [howToOpen, setHowToOpen] = useState(false);

  const refresh = () => setEvents(localDb.listEvents(userId));

  useEffect(() => {
    refresh();
    const onSync = () => refresh();
    window.addEventListener(NOTIE_CALENDAR_SYNC_EVENT, onSync);
    return () => window.removeEventListener(NOTIE_CALENDAR_SYNC_EVENT, onSync);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const rbcEvents: RbcEvent[] = useMemo(
    () =>
      events.map((e) => ({
        id: e.id,
        title: e.title,
        start: new Date(e.startTime),
        end: new Date(e.endTime),
        resource: e,
      })),
    [events],
  );

  const handleSelectSlot = (slot: SlotInfo) => {
    setDraftTitle('');
    setDraftDescription('');
    setDraftStart(slot.start as Date);
    setDraftEnd(slot.end as Date);
    setDraftOpen(true);
  };

  const createEvent = () => {
    const title = draftTitle.trim();
    if (!title) return;
    localDb.upsertEvent({
      userId,
      title,
      description: draftDescription.trim() || undefined,
      startTime: draftStart.toISOString(),
      endTime: draftEnd.toISOString(),
      source: 'notie',
    });
    setDraftOpen(false);
    refresh();
  };

  const deleteSelected = () => {
    if (!selected) return;
    localDb.deleteEvent(selected.id);
    setSelected(null);
    refresh();
  };

  const toInputValue = (d: Date) => moment(d).format('YYYY-MM-DDTHH:mm');

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold text-foreground">Calendar</h2>
          <p className="text-sm text-muted-foreground">
            Connect an ICS feed, sync events, or click a day to add something of your own.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setHowToOpen(true)}>
          <HelpCircle className="mr-1.5 h-3.5 w-3.5" />
          How to get my ICS link
        </Button>
      </div>

      <CalendarIntegration />

      <div className="notie-calendar rounded-xl border border-border bg-card/70 p-2 shadow-sm sm:p-4">
        <Calendar
          localizer={localizer}
          events={rbcEvents}
          startAccessor="start"
          endAccessor="end"
          selectable
          style={{ height: 640 }}
          views={['month']}
          defaultView="month"
          onSelectSlot={handleSelectSlot}
          onSelectEvent={(e: RbcEvent) => setSelected(e.resource)}
        />
      </div>

      <Dialog open={draftOpen} onOpenChange={setDraftOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New calendar event</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Title</Label>
              <Input
                autoFocus
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                placeholder="Writing session, deadline, meeting…"
              />
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Input value={draftDescription} onChange={(e) => setDraftDescription(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Starts</Label>
                <Input
                  type="datetime-local"
                  value={toInputValue(draftStart)}
                  onChange={(e) => setDraftStart(new Date(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label>Ends</Label>
                <Input
                  type="datetime-local"
                  value={toInputValue(draftEnd)}
                  onChange={(e) => setDraftEnd(new Date(e.target.value))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraftOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createEvent} disabled={!draftTitle.trim()}>
              Add to calendar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selected?.title}</DialogTitle>
          </DialogHeader>
          {selected?.description && <p className="text-sm text-muted-foreground">{selected.description}</p>}
          {selected && (
            <p className="text-xs text-muted-foreground">
              {moment(selected.startTime).format('MMM D, YYYY · h:mm A')} —{' '}
              {moment(selected.endTime).format('h:mm A')}
            </p>
          )}
          {selected?.source === 'ics' && (
            <p className="text-xs text-muted-foreground">
              Imported from your connected calendar (read-only source). You can remove this copy from
              Notie; it will not change your external calendar.
            </p>
          )}
          <DialogFooter>
            <Button variant="destructive" onClick={deleteSelected}>
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Delete event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <HowToUse open={howToOpen} onClose={() => setHowToOpen(false)} initialSection="calendar" />
    </div>
  );
}
