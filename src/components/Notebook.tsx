import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Archive, BookOpen, Clock, X } from 'lucide-react';

import { localDb } from '@/lib/localDb';
import type { Entry, NotebookMeta } from '@/lib/types';
import { BOOK_COLORS } from '@/lib/types';
import { formatShortDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RichEditor } from '@/components/RichEditor';
import { CategoriesPanel } from '@/components/CategoriesPanel';

interface NotebookProps {
  userId: string;
  notebookId: string;
  /** Open a specific historical entry read-only on mount (deep link). */
  initialEntryId?: string;
  onClose: () => void;
}

const AUTOSAVE_DELAY_MS = 700;

export function Notebook({ userId, notebookId, initialEntryId, onClose }: NotebookProps) {
  const [notebook, setNotebook] = useState<NotebookMeta | null>(null);
  const [entry, setEntry] = useState<Entry | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [sidebarTab, setSidebarTab] = useState<'categories' | 'history'>('categories');
  const [viewingEntry, setViewingEntry] = useState<Entry | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');

  const saveTimer = useRef<number | null>(null);

  const loadAll = () => {
    const nb = localDb.listNotebooks(userId, true).find((n) => n.id === notebookId) ?? null;
    setNotebook(nb);
    const open = localDb.ensureOpenEntry(userId, notebookId);
    setEntry(open);
    setEntries(localDb.listEntries(notebookId));
  };

  useEffect(() => {
    loadAll();
    if (initialEntryId) {
      const found = localDb.listEntries(notebookId).find((e) => e.id === initialEntryId);
      if (found && found.isArchived) setViewingEntry(found);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notebookId]);

  const previousEntry = useMemo(
    () => (entry ? localDb.getPreviousEntry(notebookId, entry.id) : null),
    [notebookId, entry],
  );

  const color = BOOK_COLORS[(notebook?.colorIndex ?? 0) % BOOK_COLORS.length];

  const scheduleSave = (patch: Partial<Pick<Entry, 'title' | 'content'>>) => {
    if (!entry) return;
    setEntry((prev) => (prev ? { ...prev, ...patch } : prev));
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      localDb.saveEntry(entry.id, patch);
      setEntries(localDb.listEntries(notebookId));
    }, AUTOSAVE_DELAY_MS);
  };

  const handleCloseEntry = () => {
    if (!entry) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    localDb.saveEntry(entry.id, { title: entry.title, content: entry.content });
    localDb.closeEntry(entry.id);
    loadAll();
  };

  const commitTitle = () => {
    if (!notebook) return;
    const title = titleDraft.trim() || notebook.title;
    localDb.updateNotebook(notebook.id, { title });
    setNotebook((n) => (n ? { ...n, title } : n));
    setRenaming(false);
  };

  if (!notebook || !entry) return null;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-border bg-card/70 px-4 py-3 backdrop-blur-sm sm:px-6">
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Back to Library">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div
          className="h-8 w-6 shrink-0 rounded-sm shadow-sm"
          style={{ background: `linear-gradient(135deg, ${color.cover}, ${color.spine})` }}
        />
        {renaming ? (
          <Input
            autoFocus
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitTitle();
              if (e.key === 'Escape') setRenaming(false);
            }}
            className="h-8 max-w-xs font-display text-base"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setTitleDraft(notebook.title);
              setRenaming(true);
            }}
            className="truncate font-display text-lg font-semibold text-foreground hover:text-moss"
            title="Rename notebook"
          >
            {notebook.title}
          </button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleCloseEntry}>
            <Archive className="mr-1.5 h-3.5 w-3.5" />
            Close entry
          </Button>
        </div>
      </header>

      {previousEntry && (
        <div className="border-b border-border/60 bg-secondary/30 px-4 py-1.5 text-xs text-muted-foreground sm:px-6">
          Previous entry:{' '}
          <button
            type="button"
            onClick={() => setViewingEntry(previousEntry)}
            className="font-medium text-moss hover:underline"
          >
            {previousEntry.title}
          </button>{' '}
          — {formatShortDate(previousEntry.updatedAt)}
        </div>
      )}

      {/* Body */}
      <div className="flex flex-1 flex-col gap-4 overflow-hidden p-4 sm:flex-row sm:p-6">
        <div className="flex flex-1 flex-col overflow-hidden">
          <Input
            value={entry.title}
            onChange={(e) => scheduleSave({ title: e.target.value })}
            placeholder="Entry title"
            className="mb-3 h-10 border-none bg-transparent px-1 font-display text-xl font-semibold shadow-none focus-visible:ring-0"
          />
          <ScrollArea className="flex-1 rounded-lg border border-border bg-card/50 px-4 py-3">
            <RichEditor content={entry.content} onChange={(html) => scheduleSave({ content: html })} />
          </ScrollArea>
        </div>

        {/* Side panel */}
        <div className="flex w-full flex-col sm:w-[340px] sm:shrink-0">
          <div className="mb-2 flex gap-1 rounded-lg bg-secondary/50 p-1">
            <button
              type="button"
              onClick={() => setSidebarTab('categories')}
              className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                sidebarTab === 'categories' ? 'bg-card text-moss shadow-sm' : 'text-muted-foreground'
              }`}
            >
              Categories
            </button>
            <button
              type="button"
              onClick={() => setSidebarTab('history')}
              className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                sidebarTab === 'history' ? 'bg-card text-moss shadow-sm' : 'text-muted-foreground'
              }`}
            >
              Previous entries
            </button>
          </div>

          <div className="flex-1 overflow-hidden rounded-lg border border-border bg-card/50 p-3">
            {sidebarTab === 'categories' ? (
              <CategoriesPanel userId={userId} notebookId={notebookId} entryId={entry.id} />
            ) : (
              <ScrollArea className="h-full max-h-[55vh]">
                <div className="space-y-1.5">
                  {entries.filter((e) => e.isArchived).length === 0 && (
                    <p className="py-4 text-center text-xs text-muted-foreground">
                      No previous entries yet — this is the first.
                    </p>
                  )}
                  {entries
                    .filter((e) => e.isArchived)
                    .map((e) => (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => setViewingEntry(e)}
                        className="flex w-full flex-col items-start rounded-md border border-border/70 bg-card px-3 py-2 text-left hover:border-moss/50"
                      >
                        <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                          <BookOpen className="h-3.5 w-3.5 text-moss-soft" />
                          {e.title}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatShortDate(e.updatedAt)}
                        </span>
                      </button>
                    ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      </div>

      {/* Read-only viewer for a previous entry */}
      <Dialog open={!!viewingEntry} onOpenChange={(open) => !open && setViewingEntry(null)}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2 pr-6">
              <span>{viewingEntry?.title}</span>
              <button
                type="button"
                onClick={() => setViewingEntry(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <p className="mb-2 text-xs text-muted-foreground">
              {viewingEntry ? formatShortDate(viewingEntry.updatedAt) : ''}
            </p>
            <div
              className="notie-prose"
              // Read-only rendering of previously written HTML content.
              dangerouslySetInnerHTML={{ __html: viewingEntry?.content || '<p></p>' }}
            />
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
