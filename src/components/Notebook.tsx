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
  /** Open a specific saved tab for editing on mount (deep link). */
  initialEntryId?: string;
  onClose: () => void;
  /** Fired after Save Tab so Library bars can refresh. */
  onEntrySaved?: () => void;
}

const AUTOSAVE_DELAY_MS = 700;

/**
 * Notebook writing surface.
 * - Draft autosaves continuously and survives back / close / reload until Save Tab
 * - Header Save: explicit persist of this page so you can leave and keep editing
 * - Bottom Save Tab: add this full page to the notebook's tab list, then open a fresh page
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
  const [savingTab, setSavingTab] = useState(false);
  const [draftHint, setDraftHint] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [selectedText, setSelectedText] = useState('');
  const [selectionOpen, setSelectionOpen] = useState(false);
  const [categoriesRefreshKey, setCategoriesRefreshKey] = useState(0);

  const saveTimer = useRef<number | null>(null);
  const entryRef = useRef<Entry | null>(null);
  /** Accumulates edits synchronously so Back/hide never loses keystrokes waiting on React or the debounce. */
  const pendingPatchRef = useRef<Partial<Pick<Entry, 'title' | 'content' | 'inspiration'>>>({});
  const loadingRef = useRef(true);

  useEffect(() => {
    entryRef.current = entry;
  }, [entry]);

  const flushDraft = useCallback(() => {
    const current = entryRef.current;
    if (!current || current.isArchived) return;
    const pending = pendingPatchRef.current;
    pendingPatchRef.current = {};
    const next = {
      title: pending.title ?? current.title,
      content: pending.content ?? current.content,
      inspiration: pending.inspiration ?? current.inspiration,
    };
    // Keep ref in sync immediately (Back can fire before the next render).
    entryRef.current = { ...current, ...next };
    localDb.saveOpenEntryDraft(current.id, next);
    localDb.writeDraft(userId, notebookId, current.id, next);
    setDraftHint('saved');
  }, [userId, notebookId]);

  const loadOpen = useCallback(() => {
    loadingRef.current = true;
    pendingPatchRef.current = {};
    const nb = localDb.getNotebook(notebookId);
    setNotebook(nb);
    if (!nb) {
      loadingRef.current = false;
      return;
    }

    if (initialEntryId) {
      const found = localDb.getEntry(initialEntryId);
      if (found?.notebookId === notebookId) {
        const working = found.isArchived ? localDb.reopenEntry(found.id) : found;
        if (working) {
          entryRef.current = working;
          setEntry(working);
          loadingRef.current = false;
          return;
        }
      }
    }

    const open = localDb.loadOrCreateOpenEntry(userId, notebookId);
    entryRef.current = open;
    setEntry(open);
    loadingRef.current = false;
  }, [notebookId, userId, initialEntryId]);

  useEffect(() => {
    loadOpen();
  }, [loadOpen]);

  // Persist draft on leave / hide / unload — not only on the debounced timer.
  useEffect(() => {
    const persist = () => {
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      flushDraft();
    };
    const onVis = () => {
      if (document.visibilityState === 'hidden') persist();
    };
    window.addEventListener('pagehide', persist);
    window.addEventListener('beforeunload', persist);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('pagehide', persist);
      window.removeEventListener('beforeunload', persist);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [flushDraft]);

  const previousEntry = useMemo(
    () => (entry ? localDb.getPreviousEntry(notebookId, entry.id) : null),
    [notebookId, entry],
  );

  const scheduleDraft = (patch: Partial<Pick<Entry, 'title' | 'content' | 'inspiration'>>) => {
    if (!entry || loadingRef.current) return;
    pendingPatchRef.current = { ...pendingPatchRef.current, ...patch };
    if (entryRef.current) {
      entryRef.current = { ...entryRef.current, ...patch };
    }
    setEntry((prev) => (prev ? { ...prev, ...patch } : prev));
    setDraftHint('saving');
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      flushDraft();
    }, AUTOSAVE_DELAY_MS);
  };

  useActivityTimer({
    enabled: Boolean(entry && !entry.isArchived),
    notebookId,
  });

  const handleBack = () => {
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    flushDraft();
    localDb.closeNotebookWithoutSaving(entryRef.current?.id ?? entry?.id ?? '');
    onClose();
  };

  /** Explicit save of this page — stays open for more editing. */
  const handleSave = () => {
    if (!entry) return;
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    flushDraft();
    setDraftHint('saved');
    toast.success('Saved', {
      description: 'This page stays here — come back anytime to keep writing.',
    });
    void syncNow();
  };

  /** Finish this page into the notebook's tab list; open a fresh blank page. */
  const handleSaveTab = () => {
    if (!entry || savingTab) return;
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }

    flushDraft();
    const latest = entryRef.current ?? entry;
    const plain = stripHtml(latest.content).trim();
    if (!plain && !latest.title.trim()) {
      toast.message('Write something before saving this tab');
      return;
    }

    setSavingTab(true);

    let working = localDb.getEntry(latest.id) ?? latest;
    if (!working.title.trim()) {
      const firstLine = plain.split('\n').find((l) => l.trim())?.trim() || '';
      const autoTitle =
        firstLine.slice(0, 60) ||
        `Tab — ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
      localDb.saveOpenEntryDraft(working.id, { title: autoTitle });
      working = { ...working, title: autoTitle };
    }

    const result = localDb.saveEntry(working.id);
    setSavingTab(false);
    if (!result) {
      toast.error('Could not save tab');
      return;
    }

    toast.success('Tab saved', {
      description: 'Added to this notebook’s tab list. A new page is ready.',
    });
    pendingPatchRef.current = {};
    setEntry(result.nextOpen);
    setDraftHint('idle');
    onEntrySaved?.();
    void syncNow();
  };

  const exportTab = () => {
    if (!entry) return;
    const text = `${entry.title || 'Untitled tab'}\n\n${stripHtml(entry.content)}`;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(entry.title || 'tab').replace(/[^\w.-]+/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Tab exported');
  };

  const reopenPastTab = (past: Entry) => {
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    flushDraft();
    const reopened = localDb.reopenEntry(past.id);
    if (!reopened) return;
    pendingPatchRef.current = {};
    setViewingEntry(null);
    setEntry(reopened);
    toast.message('Tab opened for editing');
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
        <Button variant="ghost" size="icon" onClick={handleBack} aria-label="Back to tabs">
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
          {draftHint === 'saving' ? 'Saving…' : draftHint === 'saved' ? 'Saved' : 'Autosave on'}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={exportTab} title="Export this page as text">
            <Download className="mr-1.5 h-3.5 w-3.5" />
            <span className="hidden sm:inline">Export</span>
          </Button>
          <Button size="sm" onClick={handleSave} title="Save this page — keep editing anytime">
            <Save className="mr-1.5 h-3.5 w-3.5" />
            Save
          </Button>
        </div>
      </header>

      {previousEntry && (
        <div className="shrink-0 border-b border-border/60 bg-secondary/30 px-4 py-1.5 text-xs text-muted-foreground sm:px-6">
          Previous tab:{' '}
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
              placeholder="Tab title — a full page of ideas, plans, script…"
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
              Everything you type autosaves and stays if you leave or close the app. Use Save anytime
              to confirm. When this whole page is ready for your tab list, use Save Tab below.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card/70 p-4 shadow-sm">
            <CategoriesPanel
              userId={userId}
              notebookId={notebookId}
              entryId={null}
              refreshKey={categoriesRefreshKey}
            />
          </div>

          <div className="border-t border-border/70 pt-4 pb-8">
            <Button
              className="w-full"
              size="lg"
              onClick={handleSaveTab}
              disabled={savingTab}
            >
              <Save className="mr-2 h-4 w-4" />
              Save Tab
            </Button>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              Adds this full page to the notebook’s tab list so you can open it later. Starts a new
              blank page here.
            </p>
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
              <Button onClick={() => reopenPastTab(viewingEntry)}>Open tab</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
