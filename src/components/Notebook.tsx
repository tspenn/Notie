import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Download, Save, X } from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/contexts/AuthContext';
import { useActivityTimer } from '@/hooks/useActivityTimer';
import { localDb } from '@/lib/localDb';
import type { Entry, NotebookMeta } from '@/lib/types';
import { formatShortDate, stripHtml } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RichEditor } from '@/components/RichEditor';
import { CategoriesPanel } from '@/components/CategoriesPanel';
import { SelectionActionDialog } from '@/components/SelectionActionDialog';
import { NotieMark } from '@/components/NotieMark';

interface NotebookProps {
  userId: string;
  notebookId: string;
  /** Open a specific historical entry read-only on mount (deep link). */
  initialEntryId?: string;
  onClose: () => void;
  /** Fired after Save Entry so Library bars can refresh. */
  onEntrySaved?: () => void;
}

const AUTOSAVE_DELAY_MS = 700;

/**
 * Notebook = writing surface for one book.
 * - Draft autosave while writing
 * - Save Entry archives + advances Library progress
 * - Categories card below writing: notebook-scoped (shared across entries in this book only)
 * - Past Entries live on Entry List, not here
 */
export function Notebook({
  userId,
  notebookId,
  initialEntryId,
  onClose,
  onEntrySaved,
}: NotebookProps) {
  const { syncNow } = useAuth();
  const [notebook, setNotebook] = useState<NotebookMeta | null>(null);
  const [entry, setEntry] = useState<Entry | null>(null);
  const [viewingEntry, setViewingEntry] = useState<Entry | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [savingEntry, setSavingEntry] = useState(false);
  const [draftHint, setDraftHint] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [selectedText, setSelectedText] = useState('');
  const [selectionOpen, setSelectionOpen] = useState(false);
  const [categoriesRefreshKey, setCategoriesRefreshKey] = useState(0);

  const saveTimer = useRef<number | null>(null);
  const entryRef = useRef<Entry | null>(null);
  const loadingRef = useRef(true);

  useEffect(() => {
    entryRef.current = entry;
  }, [entry]);

  const loadOpen = useCallback(() => {
    loadingRef.current = true;
    const nb = localDb.getNotebook(notebookId);
    setNotebook(nb);
    if (!nb) {
      loadingRef.current = false;
      return;
    }
    const open = localDb.loadOrCreateOpenEntry(userId, notebookId);
    setEntry(open);
    loadingRef.current = false;
  }, [notebookId, userId]);

  useEffect(() => {
    loadOpen();
    if (initialEntryId) {
      const found = localDb.getEntry(initialEntryId);
      if (found?.isArchived && found.notebookId === notebookId) {
        setViewingEntry(found);
      }
    }
  }, [loadOpen, initialEntryId, notebookId]);

  const previousEntry = useMemo(
    () => (entry ? localDb.getPreviousEntry(notebookId, entry.id) : null),
    [notebookId, entry],
  );

  const flushDraft = useCallback(
    (patch?: Partial<Pick<Entry, 'title' | 'content' | 'inspiration'>>) => {
      const current = entryRef.current;
      if (!current || current.isArchived) return;
      const next = {
        title: patch?.title ?? current.title,
        content: patch?.content ?? current.content,
        inspiration: patch?.inspiration ?? current.inspiration,
      };
      localDb.saveOpenEntryDraft(current.id, next);
      localDb.writeDraft(userId, notebookId, current.id, next);
      setDraftHint('saved');
    },
    [userId, notebookId],
  );

  const scheduleDraft = (patch: Partial<Pick<Entry, 'title' | 'content' | 'inspiration'>>) => {
    if (!entry || loadingRef.current) return;
    setEntry((prev) => (prev ? { ...prev, ...patch } : prev));
    setDraftHint('saving');
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      flushDraft(patch);
    }, AUTOSAVE_DELAY_MS);
  };

  useActivityTimer({
    enabled: Boolean(entry && !entry.isArchived),
    notebookId,
  });

  const handleBack = () => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    flushDraft();
    localDb.closeNotebookWithoutSaving(entry?.id ?? '');
    onClose();
  };

  const handleSaveEntry = () => {
    if (!entry || savingEntry) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);

    const plain = stripHtml(entry.content).trim();
    if (!plain && !entry.title.trim()) {
      toast.message('Write something before saving an Entry');
      return;
    }

    flushDraft();
    setSavingEntry(true);

    let working = localDb.getEntry(entry.id) ?? entry;
    if (!working.title.trim()) {
      const firstLine = plain.split('\n').find((l) => l.trim())?.trim() || '';
      const autoTitle =
        firstLine.slice(0, 60) ||
        `Entry — ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
      localDb.saveOpenEntryDraft(working.id, { title: autoTitle });
      working = { ...working, title: autoTitle };
    }

    const result = localDb.saveEntry(working.id);
    setSavingEntry(false);
    if (!result) {
      toast.error('Could not save Entry');
      return;
    }

    toast.success('Entry saved');
    setEntry(result.nextOpen);
    onEntrySaved?.();
    void syncNow();
  };

  const exportEntry = () => {
    if (!entry) return;
    const text = `${entry.title || 'Untitled entry'}\n\n${stripHtml(entry.content)}`;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(entry.title || 'entry').replace(/[^\w.-]+/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Entry exported');
  };

  const reopenPastEntry = (past: Entry) => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    flushDraft();
    const reopened = localDb.reopenEntry(past.id);
    if (!reopened) return;
    setViewingEntry(null);
    setEntry(reopened);
    toast.message('Entry reopened for editing');
  };

  const commitNotebookTitle = () => {
    if (!notebook) return;
    const title = titleDraft.trim() || notebook.title;
    localDb.updateNotebook(notebook.id, { title });
    setNotebook((n) => (n ? { ...n, title } : n));
    setRenaming(false);
  };

  if (!notebook || !entry) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Opening notebook…</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      <header className="flex shrink-0 items-center gap-3 border-b border-border bg-card/70 px-4 py-3 backdrop-blur-sm sm:px-6">
        <Button variant="ghost" size="icon" onClick={handleBack} aria-label="Back to entries">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <NotieMark size="sm" />
        {renaming ? (
          <Input
            autoFocus
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={commitNotebookTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitNotebookTitle();
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
        <span className="hidden text-[11px] text-muted-foreground sm:inline">
          {draftHint === 'saving' ? 'Saving draft…' : draftHint === 'saved' ? 'Draft saved' : 'Draft'}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={exportEntry} title="Export this entry as text">
            <Download className="mr-1.5 h-3.5 w-3.5" />
            <span className="hidden sm:inline">Export</span>
          </Button>
          <Button size="sm" onClick={handleSaveEntry} disabled={savingEntry}>
            <Save className="mr-1.5 h-3.5 w-3.5" />
            Save Entry
          </Button>
        </div>
      </header>

      {previousEntry && (
        <div className="shrink-0 border-b border-border/60 bg-secondary/30 px-4 py-1.5 text-xs text-muted-foreground sm:px-6">
          Previous entry:{' '}
          <button
            type="button"
            onClick={() => setViewingEntry(previousEntry)}
            className="font-medium text-moss hover:underline"
          >
            {previousEntry.title || 'Untitled'}
          </button>{' '}
          — {formatShortDate(previousEntry.updatedAt)}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-4 sm:px-6 sm:py-6">
          <div className="flex min-h-[min(62vh,36rem)] flex-col">
            <Input
              value={entry.title}
              onChange={(e) => scheduleDraft({ title: e.target.value })}
              placeholder="Entry title"
              className="mb-3 h-10 border-none bg-transparent px-1 font-display text-xl font-semibold shadow-none focus-visible:ring-0"
            />
            <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-border bg-card/50 px-3 py-3 sm:px-4">
              <RichEditor
                className="flex min-h-[min(52vh,30rem)] flex-1 flex-col"
                content={entry.content}
                onChange={(html) => scheduleDraft({ content: html })}
                onTextSelected={(text) => {
                  setSelectedText(text);
                  setSelectionOpen(true);
                }}
              />
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Draft autosaves while you write. Use Save Entry when this block of writing is finished —
              that adds it to history and fills the Library book.
            </p>
          </div>

          {/* Notebook-scoped category items — shared across entries in this book only */}
          <div className="rounded-xl border border-border bg-card/70 p-4 shadow-sm">
            <CategoriesPanel
              userId={userId}
              notebookId={notebookId}
              entryId={null}
              refreshKey={categoriesRefreshKey}
            />
          </div>
        </div>
      </div>

      <SelectionActionDialog
        open={selectionOpen}
        selectedText={selectedText}
        userId={userId}
        notebookId={notebookId}
        entryId={null}
        onOpenChange={setSelectionOpen}
        onSaved={() => setCategoriesRefreshKey((k) => k + 1)}
      />

      <Dialog open={!!viewingEntry} onOpenChange={(open) => !open && setViewingEntry(null)}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2 pr-6">
              <span>{viewingEntry?.title || 'Untitled'}</span>
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
              dangerouslySetInnerHTML={{ __html: viewingEntry?.content || '<p></p>' }}
            />
          </ScrollArea>
          {viewingEntry && (
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setViewingEntry(null)}>
                Close
              </Button>
              <Button onClick={() => reopenPastEntry(viewingEntry)}>Reopen Entry</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
