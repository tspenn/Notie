import { Archive, Maximize2, Menu, StickyNote } from 'lucide-react';
import { useState } from 'react';

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { SessionDoor } from '@/lib/openSessionStack';
import { dayKeyFromMs, dayLabelFromKey, doorKey } from '@/lib/openSessionStack';

interface OpenSessionStackProps {
  doors: SessionDoor[];
  onOpen: (door: SessionDoor) => void;
  onArchiveLive: () => void;
  onSideNote: (door: SessionDoor, text: string) => void | Promise<void>;
  onExpandNote: (door: SessionDoor, text: string) => void | Promise<void>;
}

export function OpenSessionStack({
  doors,
  onOpen,
  onArchiveLive,
  onSideNote,
  onExpandNote,
}: OpenSessionStackProps) {
  const [stackOpen, setStackOpen] = useState(false);
  const [view, setView] = useState<'live' | 'archived'>('live');
  const live = doors.filter((d) => !d.archived);
  const archived = doors.filter((d) => d.archived);

  const archivedGroups = (() => {
    const map = new Map<string, SessionDoor[]>();
    for (const d of archived) {
      const key = dayKeyFromMs(d.archivedAt || d.lastAt);
      const list = map.get(key);
      if (list) list.push(d);
      else map.set(key, [d]);
    }
    return Array.from(map.keys())
      .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))
      .map((dayKey) => ({
        dayKey,
        label: dayLabelFromKey(dayKey),
        entries: map.get(dayKey) || [],
      }));
  })();

  return (
    <Popover open={stackOpen} onOpenChange={setStackOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border/80 bg-background/95 text-muted-foreground shadow-md backdrop-blur-sm transition-colors hover:border-primary/40 hover:text-primary"
          aria-label="Places visited"
        >
          <Menu className="h-5 w-5" strokeWidth={2} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="left"
        align="end"
        className="w-80 border-border bg-popover p-0 text-popover-foreground shadow-xl"
      >
        <div className="flex items-center gap-2 border-b border-border px-3 pb-2 pt-2.5">
          <button
            type="button"
            onClick={() => setView('live')}
            className={`rounded-full border px-2 py-0.5 text-[10px] ${
              view === 'live'
                ? 'border-primary/50 text-primary'
                : 'border-border text-muted-foreground'
            }`}
          >
            Live
          </button>
          <button
            type="button"
            onClick={() => setView('archived')}
            className={`rounded-full border px-2 py-0.5 text-[10px] ${
              view === 'archived'
                ? 'border-primary/50 text-primary'
                : 'border-border text-muted-foreground'
            }`}
          >
            Archived
          </button>
          {view === 'live' && live.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                onArchiveLive();
                setView('archived');
              }}
              className="ml-auto flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-[10px] text-muted-foreground shadow-none hover:text-foreground"
              title="Archive this whole list"
            >
              <Archive className="h-3 w-3" />
              Archive list
            </button>
          ) : null}
        </div>

        {view === 'live' && live.length === 0 && (
          <p className="px-3 py-6 text-center text-[11px] text-muted-foreground">
            Open a draft or tab and it lands here — a running tally of where you’ve been.
          </p>
        )}

        {view === 'live' && live.length > 0 && (
          <ul className="max-h-[min(55vh,380px)] overflow-y-auto py-1">
            {live.map((door) => (
              <DoorRow
                key={doorKey(door)}
                door={door}
                onOpen={onOpen}
                onSideNote={onSideNote}
                onExpandNote={async (d, text) => {
                  setStackOpen(false);
                  await onExpandNote(d, text);
                }}
              />
            ))}
          </ul>
        )}

        {view === 'archived' && archived.length === 0 && (
          <p className="px-3 py-6 text-center text-[11px] text-muted-foreground">
            Archive the live list when it gets too long. It moves here by date.
          </p>
        )}

        {view === 'archived' && archived.length > 0 && (
          <div className="max-h-[min(55vh,380px)] overflow-y-auto">
            {archivedGroups.map((g) => (
              <section key={g.dayKey} className="px-0 pb-2">
                <h3 className="px-3 pb-1 pt-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {g.label}
                </h3>
                <ul>
                  {g.entries.map((door) => (
                    <DoorRow
                      key={doorKey(door)}
                      door={door}
                      onOpen={onOpen}
                      onSideNote={onSideNote}
                      onExpandNote={async (d, text) => {
                        setStackOpen(false);
                        await onExpandNote(d, text);
                      }}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function DoorRow({
  door,
  onOpen,
  onSideNote,
  onExpandNote,
}: {
  door: SessionDoor;
  onOpen: (door: SessionDoor) => void;
  onSideNote: (door: SessionDoor, text: string) => void | Promise<void>;
  onExpandNote: (door: SessionDoor, text: string) => void | Promise<void>;
}) {
  const [jotOpen, setJotOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const latest = door.sideNotes?.[0];
  const title = door.entryLabel || door.notebookTitle || 'Draft';
  const subtitle =
    door.entryLabel && door.notebookTitle && door.notebookTitle !== door.entryLabel
      ? door.notebookTitle
      : '';

  const save = () => {
    const text = draft.trim();
    if (!text) {
      setJotOpen(false);
      return;
    }
    void onSideNote(door, text);
    setDraft('');
    setJotOpen(false);
  };

  const expand = () => {
    const text = draft.trim();
    setDraft('');
    setJotOpen(false);
    void onExpandNote(door, text);
  };

  return (
    <li className="hover:bg-muted/60">
      <div className="flex items-stretch gap-0">
        <button
          type="button"
          onClick={() => onOpen(door)}
          className="min-w-0 flex-1 cursor-pointer border-0 bg-transparent px-3 py-2 text-left shadow-none"
        >
          <div className="truncate font-display text-[13px] text-foreground">{title}</div>
          {subtitle ? (
            <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{subtitle}</div>
          ) : null}
          {latest ? (
            <div className="mt-0.5 truncate text-[11px] text-muted-foreground/90">{latest.text}</div>
          ) : null}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setJotOpen((open) => !open);
          }}
          className="cursor-pointer border-0 bg-transparent px-2 text-muted-foreground shadow-none hover:text-primary"
          aria-label={`Note on ${title}`}
          title="Quick note"
        >
          <StickyNote className="h-3.5 w-3.5" />
        </button>
      </div>
      {jotOpen ? (
        <div className="px-3 pb-2">
          <textarea
            autoFocus
            rows={3}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setJotOpen(false);
                setDraft('');
              }
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                save();
              }
            }}
            placeholder="A note for this place"
            className="min-h-[4.5rem] w-full resize-y rounded border border-border bg-background px-2 py-1.5 text-[12px] text-foreground outline-none placeholder:text-muted-foreground"
          />
          <div className="mt-1.5 flex items-center justify-end">
            <button
              type="button"
              onClick={expand}
              className="flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-[10px] text-primary shadow-none hover:text-primary/80"
              title="Open this writing and keep going"
            >
              <Maximize2 className="h-3 w-3" />
              Expand
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
