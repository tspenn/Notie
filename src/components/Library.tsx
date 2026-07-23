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

/** Spine width varies slightly so the shelf reads like real bindings. */
function spineWidth(title: string): number {
  let hash = 0;
  for (let i = 0; i < title.length; i++) hash = (hash * 31 + title.charCodeAt(i)) | 0;
  return 36 + (Math.abs(hash) % 14); // 36–49px
}

/**
 * Book binding on the Library shelf.
 * Height = Canvas growth curve (investment minutes).
 * Title runs sideways on the spine, top → bottom.
 */
function BookBinding({ data, onOpen }: { data: NotebookShelfData; onOpen: () => void }) {
  const width = spineWidth(data.notebook.title);
  const label =
    data.totalMinutes > 0
      ? `${data.notebook.title} · ${formatBarMinutes(data.totalMinutes)}${
          data.todayMinutes > 0 ? ` · +${data.todayMinutes}m today` : ''
        }`
      : data.notebook.title;

  return (
    <div className="animate-shelf-in flex flex-col items-center">
      {data.previousEntry && (
        <p className="mb-2 max-w-[4.5rem] px-0.5 text-center text-[10px] leading-snug text-muted-foreground">
          Previous:{' '}
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
        title={label}
        aria-label={`Open notebook ${data.notebook.title}`}
        className="group relative flex shrink-0 flex-col items-center transition duration-300 hover:brightness-110"
        style={{ width }}
      >
        {/* Book binding / spine */}
        <div
          className="relative overflow-hidden rounded-t-[2px] shadow-md"
          style={{
            width,
            height: data.barHeight,
            background: `linear-gradient(90deg, ${data.color.spine} 0%, ${data.color.cover} 18%, ${data.color.cover} 82%, ${data.color.spine} 100%)`,
            boxShadow: `2px 0 0 0 ${data.color.spine}99, -1px 0 0 0 rgba(0,0,0,0.35), 0 -2px 12px 0 ${data.color.hex}33`,
          }}
        >
          {/* Binding edges */}
          <div className="pointer-events-none absolute inset-y-0 left-0 w-[3px] bg-black/35" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-[3px] bg-black/40" />
          {/* Embossed bands */}
          <div className="pointer-events-none absolute inset-x-1.5 top-2 h-px bg-black/25" />
          <div className="pointer-events-none absolute inset-x-1.5 top-3 h-px bg-white/15" />
          <div className="pointer-events-none absolute inset-x-1.5 bottom-3 h-px bg-black/20" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/20 via-transparent to-black/25" />

          {/* Project name on the binding — top to bottom */}
          <div className="absolute inset-0 flex items-center justify-center px-0.5 py-3">
            <span
              className="max-h-full overflow-hidden text-ellipsis whitespace-nowrap font-display text-[10px] font-semibold tracking-wide text-sand drop-shadow-sm sm:text-[11px]"
              style={{
                writingMode: 'vertical-rl',
                textOrientation: 'mixed',
              }}
            >
              {data.notebook.title}
            </span>
          </div>
        </div>
        {/* Shelf contact edge */}
        <div
          className="h-[3px] w-full rounded-b-[1px]"
          style={{ backgroundColor: data.color.spine }}
        />
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
            Start a notebook for a writing project. Save Entry when a block of writing is finished —
            the binding on the shelf shows Growth.
          </p>
          <Button className="mt-5" onClick={() => setCreating(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Start your first notebook
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto pb-2">
          <div className="flex min-h-[260px] items-end gap-2.5 border-b border-border/80 px-2 pt-4 sm:gap-3">
            {shelf.map((data) => (
              <BookBinding
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
