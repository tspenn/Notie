import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';

import { localDb } from '@/lib/localDb';
import { formatBarMinutes, type NotebookShelfData } from '@/lib/types';
import { formatShortDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ReadingLamp } from '@/components/ReadingLamp';

interface LibraryProps {
  userId: string;
  /** Open Entry List for this book (not Notebook). */
  onOpenBook: (id: string) => void;
  refreshKey?: number;
}

/** Single book-styled progress bar (= Canvas LandscapeColumn). */
function BookBar({ data, onOpen }: { data: NotebookShelfData; onOpen: () => void }) {
  return (
    <div className="animate-shelf-in flex min-w-[4.5rem] flex-col items-center">
      {data.previousEntry && (
        <p className="mb-2 w-full px-0.5 text-center text-[10px] leading-snug text-muted-foreground">
          Previous entry:{' '}
          <span className="font-medium text-foreground">
            {data.previousEntry.title || 'Untitled'}
          </span>
          <br />
          {formatShortDate(data.previousEntry.updatedAt)}
        </p>
      )}

      <button
        type="button"
        onClick={onOpen}
        className="group flex w-full flex-col items-center rounded-md px-1 py-1 transition hover:bg-secondary/40"
        title={`Open “${data.notebook.title}”`}
      >
        <p className="mb-1 line-clamp-2 w-full px-0.5 text-center font-display text-[11px] font-semibold leading-tight text-foreground">
          {data.notebook.title}
        </p>
        {data.totalMinutes > 0 && (
          <p className="mb-0.5 font-ui text-[10px] tabular-nums text-muted-foreground">
            {formatBarMinutes(data.totalMinutes)}
          </p>
        )}
        {data.todayMinutes > 0 && (
          <p className="mb-1 font-ui text-[9px] tabular-nums text-moss">+{data.todayMinutes}m today</p>
        )}

        <div
          className="relative w-11 overflow-hidden rounded-t-[3px] shadow-md transition duration-300 group-hover:brightness-110"
          style={{
            height: data.barHeight,
            background: `linear-gradient(180deg, ${data.color.cover} 0%, ${data.color.spine} 100%)`,
            boxShadow: `0 -2px 14px 0 ${data.color.hex}40`,
          }}
        >
          <div
            className="absolute inset-y-0 left-0 w-1.5"
            style={{ backgroundColor: data.color.spine }}
          />
          <div className="absolute inset-x-2 top-2 h-px bg-black/15" />
          <div className="absolute inset-x-2 bottom-3 h-px bg-black/10" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-white/10" />
        </div>
        <div className="h-px w-11" style={{ backgroundColor: data.color.hex, opacity: 0.55 }} />
      </button>
    </div>
  );
}

export function Library({ userId, onOpenBook, refreshKey = 0 }: LibraryProps) {
  const [shelf, setShelf] = useState<NotebookShelfData[]>([]);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const refresh = () => setShelf(localDb.listShelf(userId));

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, refreshKey]);

  const createNotebook = () => {
    const title = newTitle.trim();
    if (!title) return;
    const nb = localDb.createNotebook(userId, title);
    setNewTitle('');
    setCreating(false);
    refresh();
    onOpenBook(nb.id);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold text-foreground">Library</h2>
          <p className="text-sm text-muted-foreground">Books grow as writing time.</p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          New notebook
        </Button>
      </div>

      {shelf.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <ReadingLamp size={48} />
          <p className="mt-4 font-display text-lg text-foreground">The shelf is empty, for now.</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Start a notebook. Write freely, then Save Entry when a block of writing is finished —
            that fills the book.
          </p>
          <Button className="mt-5" onClick={() => setCreating(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Start your first notebook
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto pb-2">
          <div className="flex min-h-[260px] items-end gap-6 border-b border-border/80 px-2 pt-4">
            {shelf.map((data) => (
              <BookBar
                key={data.notebook.id}
                data={data}
                onOpen={() => onOpenBook(data.notebook.id)}
              />
            ))}
          </div>
          <div className="h-3 rounded-b-sm bg-gradient-to-b from-sand-deep/80 to-transparent" />
        </div>
      )}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New notebook</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="e.g. Morning pages, Bible study, The long novel"
            onKeyDown={(e) => {
              if (e.key === 'Enter') createNotebook();
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button onClick={createNotebook} disabled={!newTitle.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
