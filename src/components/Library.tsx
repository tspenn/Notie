import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';

import { localDb } from '@/lib/localDb';
import { BOOK_COLORS, type NotebookMeta } from '@/lib/types';
import { formatShortDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ReadingLamp } from '@/components/ReadingLamp';

interface LibraryProps {
  userId: string;
  onOpenNotebook: (id: string) => void;
}

function BookSpine({ colorIndex }: { colorIndex: number }) {
  const color = BOOK_COLORS[colorIndex % BOOK_COLORS.length];
  return (
    <div
      className="relative h-20 w-14 shrink-0 overflow-hidden rounded-[3px] shadow-md ring-1 ring-black/10"
      style={{ background: `linear-gradient(120deg, ${color.cover} 35%, ${color.cover} 100%)` }}
      aria-hidden="true"
    >
      <div className="absolute inset-y-0 left-0 w-2.5" style={{ backgroundColor: color.spine }} />
      <div className="absolute inset-x-3 top-3 h-px bg-black/15" />
      <div className="absolute inset-x-3 bottom-3 h-px bg-black/15" />
    </div>
  );
}

function NotebookRow({
  notebook,
  onOpen,
  onChanged,
}: {
  notebook: NotebookMeta;
  onOpen: () => void;
  onChanged: () => void;
}) {
  const [inspiration, setInspiration] = useState(notebook.inspiration);
  const previousEntry = useMemo(() => localDb.getPreviousEntry(notebook.id), [notebook.id]);

  useEffect(() => setInspiration(notebook.inspiration), [notebook.inspiration]);

  const saveInspiration = () => {
    if (inspiration === notebook.inspiration) return;
    localDb.updateNotebook(notebook.id, { inspiration });
    onChanged();
  };

  return (
    <div className="animate-shelf-in rounded-xl border border-border bg-card/70 p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5">
      {previousEntry && (
        <p className="mb-3 text-xs text-muted-foreground">
          Previous entry: <span className="font-medium text-foreground">{previousEntry.title}</span> —{' '}
          {formatShortDate(previousEntry.updatedAt)}
        </p>
      )}

      <div className="flex flex-col gap-4 md:grid md:grid-cols-[minmax(0,240px)_1fr] md:items-center md:gap-6">
        {/* Left: book + title */}
        <button
          type="button"
          onClick={onOpen}
          className="flex items-center gap-4 text-left"
          title={`Open "${notebook.title}"`}
        >
          <BookSpine colorIndex={notebook.colorIndex} />
          <span className="font-display text-lg font-semibold leading-snug text-foreground group-hover:text-moss">
            {notebook.title}
          </span>
        </button>

        {/* Right: reading lamp + Inspiration (kept together on small screens) */}
        <div className="flex items-center gap-3">
          <ReadingLamp size={36} alt="" />
          <div className="min-w-0 flex-1">
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Inspiration
            </label>
            <Input
              value={inspiration}
              placeholder="A line to return to"
              onChange={(e) => setInspiration(e.target.value)}
              onBlur={saveInspiration}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              }}
              className="h-9 border-none bg-secondary/40 text-sm shadow-none focus-visible:ring-1"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export function Library({ userId, onOpenNotebook }: LibraryProps) {
  const [notebooks, setNotebooks] = useState<NotebookMeta[]>([]);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const refresh = () => setNotebooks(localDb.listNotebooks(userId));

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const createNotebook = () => {
    const title = newTitle.trim();
    if (!title) return;
    const nb = localDb.createNotebook(userId, title);
    setNewTitle('');
    setCreating(false);
    refresh();
    onOpenNotebook(nb.id);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold text-foreground">Library</h2>
          <p className="text-sm text-muted-foreground">Your notebooks, shelved and ready.</p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          New notebook
        </Button>
      </div>

      {notebooks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <ReadingLamp size={40} />
          <p className="mt-4 font-display text-lg text-foreground">The shelf is empty, for now.</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Start a notebook for the writing that takes time — a journal, a study, a novel's notes.
          </p>
          <Button className="mt-5" onClick={() => setCreating(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Start your first notebook
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {notebooks.map((nb) => (
            <NotebookRow key={nb.id} notebook={nb} onOpen={() => onOpenNotebook(nb.id)} onChanged={refresh} />
          ))}
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
