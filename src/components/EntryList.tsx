import { useEffect, useState } from 'react';
import { ArrowLeft, BookOpen, Clock } from 'lucide-react';
import { toast } from 'sonner';

import { localDb } from '@/lib/localDb';
import { formatBarMinutes, type Entry, type NotebookMeta, type NotebookShelfData } from '@/lib/types';
import { formatShortDate, stripHtml } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ReadingLamp } from '@/components/ReadingLamp';
import { NotieMark } from '@/components/NotieMark';

interface EntryListProps {
  userId: string;
  notebookId: string;
  refreshKey?: number;
  onBack: () => void;
  /** Open the current writing space (open entry). */
  onOpenNotebook: () => void;
  /** Open a past saved Entry in Notebook. */
  onOpenEntry: (entryId: string) => void;
}

function entrySummary(entry: Entry, max = 150): string {
  const text = stripHtml(entry.content).replace(/\s+/g, ' ').trim();
  if (!text) return 'No summary yet.';
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}…`;
}

export function EntryList({
  userId,
  notebookId,
  refreshKey = 0,
  onBack,
  onOpenNotebook,
  onOpenEntry,
}: EntryListProps) {
  const [notebook, setNotebook] = useState<NotebookMeta | null>(null);
  const [shelf, setShelf] = useState<NotebookShelfData | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [inspiration, setInspiration] = useState('');

  const refresh = () => {
    const nb = localDb.getNotebook(notebookId);
    setNotebook(nb);
    const shelfRow = localDb.listShelf(userId).find((s) => s.notebook.id === notebookId) ?? null;
    setShelf(shelfRow);
    setInspiration(shelfRow?.inspiration ?? '');
    setEntries(localDb.listEntries(notebookId).filter((e) => e.isArchived));
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, notebookId, refreshKey]);

  if (!notebook) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">Notebook not found.</div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back to Library">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <NotieMark size="md" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-2xl font-semibold text-foreground">
            {notebook.title}
          </h2>
          <p className="text-sm text-muted-foreground">Saved entries</p>
        </div>
      </div>

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        {/* Past Entries list */}
        <div className="min-w-0 flex-1 space-y-3">
          {entries.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border py-14 text-center">
              <BookOpen className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="mt-3 font-display text-lg text-foreground">No saved entries yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Open the notebook to write, then Save Entry when a chapter is finished.
              </p>
            </div>
          ) : (
            <ScrollArea className="max-h-[60vh] pr-1">
              <div className="space-y-2.5">
                {entries.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => onOpenEntry(entry.id)}
                    className="flex w-full flex-col items-start rounded-xl border border-border bg-card/70 px-4 py-3 text-left shadow-sm transition hover:border-moss/45 hover:bg-card"
                  >
                    <span className="font-display text-base font-semibold text-foreground">
                      {entry.title || 'Untitled'}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatShortDate(entry.updatedAt)}
                      {entry.writingMinutes > 0
                        ? ` · ${Math.round(entry.writingMinutes)}m`
                        : ''}
                    </span>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {entrySummary(entry)}
                    </p>
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Inspiration card — Entries list page (not Library) */}
        <aside className="flex w-full flex-col rounded-xl border border-border bg-card/70 p-4 shadow-sm lg:w-72 lg:shrink-0">
          <div className="mb-3 flex items-start gap-3">
            <ReadingLamp size={36} />
            <div className="min-w-0 flex-1">
              <p className="font-display text-sm font-semibold text-foreground">{notebook.title}</p>
              <p className="text-[11px] text-muted-foreground">
                {shelf && shelf.totalMinutes > 0
                  ? formatBarMinutes(shelf.totalMinutes)
                  : 'No saved time yet'}
                {shelf && shelf.todayMinutes > 0 ? ` · +${shelf.todayMinutes}m today` : ''}
              </p>
            </div>
          </div>

          <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Inspiration
          </label>
          <Input
            value={inspiration}
            placeholder="A line to return to"
            onChange={(e) => setInspiration(e.target.value)}
            onBlur={() => {
              if (inspiration !== (shelf?.inspiration ?? '')) {
                localDb.setInspiration(notebookId, inspiration);
                toast.message('Inspiration saved');
                refresh();
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
            className="mb-4 border-none bg-secondary/50 text-sm shadow-none focus-visible:ring-1"
          />

          <Button className="mt-auto" onClick={onOpenNotebook}>
            Open notebook
          </Button>
        </aside>
      </div>
    </div>
  );
}
