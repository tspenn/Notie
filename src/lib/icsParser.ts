import { rrulestr } from 'rrule';

const LOOKBACK_DAYS = 30;
const LOOKAHEAD_DAYS = 730;
const MAX_RECURRING_OCCURRENCES = 2000;

export { LOOKBACK_DAYS, LOOKAHEAD_DAYS };

function unfoldLines(raw: string): string[] {
  return raw.replace(/\r\n[ \t]/g, '').replace(/\r\n/g, '\n').split('\n');
}

function parseIcsDate(val: string): Date | null {
  if (/^\d{8}$/.test(val)) {
    return new Date(`${val.slice(0, 4)}-${val.slice(4, 6)}-${val.slice(6, 8)}T00:00:00`);
  }
  if (/^\d{8}T\d{6}Z$/.test(val)) {
    return new Date(
      `${val.slice(0, 4)}-${val.slice(4, 6)}-${val.slice(6, 8)}T${val.slice(9, 11)}:${val.slice(11, 13)}:${val.slice(13, 15)}Z`,
    );
  }
  if (/^\d{8}T\d{6}$/.test(val)) {
    return new Date(
      `${val.slice(0, 4)}-${val.slice(4, 6)}-${val.slice(6, 8)}T${val.slice(9, 11)}:${val.slice(11, 13)}:${val.slice(13, 15)}`,
    );
  }
  return null;
}

export interface IcsEvent {
  uid: string;
  title: string;
  description: string;
  location: string;
  start: Date;
  end: Date;
}

export function normalizeCalendarUrl(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  const normalized = trimmed.startsWith('webcal://')
    ? `https://${trimmed.slice('webcal://'.length)}`
    : trimmed;
  try {
    return new URL(normalized).toString();
  } catch {
    return null;
  }
}

export function extractHost(rawUrl: string): string | null {
  const normalized = normalizeCalendarUrl(rawUrl);
  if (!normalized) return null;
  try {
    return new URL(normalized).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function parseIcs(raw: string): IcsEvent[] {
  const lines = unfoldLines(raw);
  type RawIcsEvent = {
    uid: string;
    title: string;
    description: string;
    location: string;
    startRaw: string;
    endRaw?: string;
    rruleRaw?: string;
    recurrenceIdRaw?: string;
    exdateRaw: string[];
  };

  const rawEvents: RawIcsEvent[] = [];
  let inEvent = false;
  let current: Partial<RawIcsEvent> = {};

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      inEvent = true;
      current = {};
      continue;
    }
    if (line === 'END:VEVENT') {
      inEvent = false;
      if (current.uid && current.startRaw) {
        rawEvents.push({
          uid: current.uid,
          title: current.title || '(No title)',
          description: current.description || '',
          location: current.location || '',
          startRaw: current.startRaw,
          endRaw: current.endRaw,
          rruleRaw: current.rruleRaw,
          recurrenceIdRaw: current.recurrenceIdRaw,
          exdateRaw: current.exdateRaw || [],
        });
      }
      continue;
    }
    if (!inEvent) continue;

    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).split(';')[0].toUpperCase();
    const value = line
      .slice(colonIdx + 1)
      .trim()
      .replace(/\\n/g, '\n')
      .replace(/\\,/g, ',')
      .replace(/\\;/g, ';')
      .replace(/\\\\/g, '\\');

    if (key === 'UID') current.uid = value;
    else if (key === 'SUMMARY') current.title = value;
    else if (key === 'DESCRIPTION') current.description = value;
    else if (key === 'LOCATION') current.location = value;
    else if (key === 'DTSTART') current.startRaw = value;
    else if (key === 'DTEND') current.endRaw = value;
    else if (key === 'RRULE') current.rruleRaw = value;
    else if (key === 'RECURRENCE-ID') current.recurrenceIdRaw = value;
    else if (key === 'EXDATE') {
      const parts = value
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
      current.exdateRaw = [...(current.exdateRaw || []), ...parts];
    }
  }

  const rangeStart = new Date();
  rangeStart.setDate(rangeStart.getDate() - LOOKBACK_DAYS);
  const rangeEnd = new Date();
  rangeEnd.setDate(rangeEnd.getDate() + LOOKAHEAD_DAYS);

  const recurrenceOverrides = new Map<string, RawIcsEvent>();
  for (const event of rawEvents) {
    if (!event.recurrenceIdRaw) continue;
    const recurrenceDate = parseIcsDate(event.recurrenceIdRaw);
    if (!recurrenceDate) continue;
    recurrenceOverrides.set(`${event.uid}::${recurrenceDate.getTime()}`, event);
  }

  const events: IcsEvent[] = [];
  for (const event of rawEvents) {
    if (event.recurrenceIdRaw) continue;

    const start = parseIcsDate(event.startRaw);
    if (!start) continue;
    const parsedEnd = event.endRaw ? parseIcsDate(event.endRaw) : null;
    const end = parsedEnd ?? start;
    const durationMs = Math.max(0, end.getTime() - start.getTime());

    const pushOccurrence = (occStart: Date, source: RawIcsEvent, occEnd?: Date) => {
      const finalEnd = occEnd ?? new Date(occStart.getTime() + durationMs);
      events.push({
        uid: source.uid,
        title: source.title || '(No title)',
        description: source.description || '',
        location: source.location || '',
        start: occStart,
        end: finalEnd,
      });
    };

    if (!event.rruleRaw) {
      pushOccurrence(start, event, end);
      continue;
    }

    try {
      const rule = rrulestr(event.rruleRaw, { dtstart: start });
      const exdateTimes = new Set(
        event.exdateRaw
          .map((ex) => parseIcsDate(ex))
          .filter((d): d is Date => !!d)
          .map((d) => d.getTime()),
      );

      const occurrences = rule.between(rangeStart, rangeEnd, true).slice(0, MAX_RECURRING_OCCURRENCES);
      for (const occStart of occurrences) {
        if (exdateTimes.has(occStart.getTime())) continue;

        const override = recurrenceOverrides.get(`${event.uid}::${occStart.getTime()}`);
        if (override) {
          const overrideStart = parseIcsDate(override.startRaw) ?? occStart;
          const overrideEndRaw = override.endRaw ? parseIcsDate(override.endRaw) : null;
          const overrideEnd = overrideEndRaw ?? new Date(overrideStart.getTime() + durationMs);
          pushOccurrence(overrideStart, override, overrideEnd);
        } else {
          pushOccurrence(occStart, event);
        }
      }
    } catch {
      pushOccurrence(start, event, end);
    }
  }

  return events;
}
