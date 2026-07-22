import { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Paperclip,
  X,
  FileText,
  Image as ImageIcon,
  Share2,
  ClipboardCopy,
  Link2,
  Printer,
  Download,
  FolderInput,
} from 'lucide-react';
import { toast } from 'sonner';

import { localDb } from '@/lib/localDb';
import { notebookLink } from '@/lib/deepLinks';
import {
  CHECKABLE_CATEGORIES,
  DEFAULT_CATEGORIES,
  type CategoryKey,
  type NotebookMeta,
  type SavedItem,
} from '@/lib/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface CategoriesPanelProps {
  userId: string;
  notebookId: string;
  entryId: string | null;
  /** Bump when items are saved from outside (e.g. selection dialog). */
  refreshKey?: number;
}

async function writeClipboardText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

function itemToText(item: SavedItem, idx: number): string {
  const n = idx + 1;
  if (item.contentType === 'image') {
    return `${n}. [Image] ${String(item.contentData?.filename ?? 'image')}`;
  }
  if (item.contentType === 'file') {
    return `${n}. [File] ${String(item.contentData?.filename ?? 'file')}`;
  }
  return `${n}. ${item.content}${item.completed ? ' (done)' : ''}`;
}

/**
 * Categories: Files, Gallery, Plans, Lists, To Do, plus custom.
 * Selected category shows Canvas-style actions (no Lab) in Notie colors.
 */
export function CategoriesPanel({
  userId,
  notebookId,
  entryId,
  refreshKey = 0,
}: CategoriesPanelProps) {
  const [items, setItems] = useState<SavedItem[]>([]);
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [active, setActive] = useState<CategoryKey>('Files');
  const [draft, setDraft] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sendOpen, setSendOpen] = useState(false);
  const [otherNotebooks, setOtherNotebooks] = useState<NotebookMeta[]>([]);

  const refresh = () => {
    setItems(localDb.listSavedItems(notebookId));
    setCustomCategories(localDb.listCustomCategories(notebookId).map((c) => c.name));
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notebookId, refreshKey]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [active]);

  const categories: CategoryKey[] = [...DEFAULT_CATEGORIES, ...customCategories];
  const itemsForActive = useMemo(
    () => items.filter((i) => i.category === active),
    [items, active],
  );
  const selectedItems = useMemo(
    () => itemsForActive.filter((i) => selectedIds.has(i.id)),
    [itemsForActive, selectedIds],
  );
  const isChecklist = CHECKABLE_CATEGORIES.has(active);
  const isFileCategory = active === 'Files' || active === 'Gallery';
  const notebookTitle = localDb.getNotebook(notebookId)?.title ?? 'Notebook';

  const actionBtn =
    'h-8 justify-start border-border bg-card text-[11px] text-moss hover:bg-moss/10 hover:text-moss';

  const requireSelection = (): SavedItem[] | null => {
    if (selectedItems.length === 0) {
      toast.error('No items selected', { description: 'Select at least one item first.' });
      return null;
    }
    return selectedItems;
  };

  const buildShareText = (list: SavedItem[]) => {
    const divider = '─'.repeat(40);
    return [
      `${notebookTitle} — ${active}`,
      '',
      ...list.map((item, idx) => itemToText(item, idx) + '\n' + divider),
    ].join('\n');
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(itemsForActive.map((i) => i.id)));
  const deselectAll = () => setSelectedIds(new Set());

  const shareSelected = async () => {
    const list = requireSelection();
    if (!list) return;
    const shareText = buildShareText(list);
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: `${notebookTitle} — ${active}`, text: shareText });
        return;
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
      }
    }
    const copied = await writeClipboardText(shareText);
    if (copied) toast.success('Copied to clipboard — paste anywhere.');
    else toast.error('Could not share', { description: 'Try Copy or Save to Device.' });
  };

  const copySelected = async () => {
    const list = requireSelection();
    if (!list) return;
    const ok = await writeClipboardText(buildShareText(list));
    if (ok) toast.success('Copied');
    else toast.error('Could not copy');
  };

  const copyNotebookLink = async () => {
    const hash = notebookLink(notebookId);
    const url = `${window.location.origin}${window.location.pathname}${hash}`;
    const ok = await writeClipboardText(url);
    if (ok) toast.success('Link copied');
    else toast.error('Could not copy link');
  };

  const printSelected = () => {
    const list = requireSelection();
    if (!list) return;
    const body = list
      .map((item, idx) => {
        if (item.contentType === 'image') {
          return `<p><strong>${idx + 1}.</strong></p><img src="${item.content}" style="max-width:100%;max-height:320px" alt="" />`;
        }
        return `<p><strong>${idx + 1}.</strong> ${item.content
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\n/g, '<br/>')}</p>`;
      })
      .join('');
    const html = `<!doctype html><html><head><title>${notebookTitle} — ${active}</title>
      <style>body{font-family:Georgia,serif;padding:24px;color:#1a1a1a} h1{font-size:18px}</style>
      </head><body><h1>${notebookTitle} — ${active}</h1>${body}</body></html>`;
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:800px;height:600px';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(iframe);
      toast.error('Print failed');
      return;
    }
    doc.open();
    doc.write(html);
    doc.close();
    iframe.onload = () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    };
  };

  const saveToDevice = () => {
    const list = requireSelection();
    if (!list) return;

    // If a single file/image is selected, download that asset; otherwise text bundle.
    if (list.length === 1 && (list[0].contentType === 'file' || list[0].contentType === 'image')) {
      const item = list[0];
      const a = document.createElement('a');
      a.href = item.content;
      a.download = String(item.contentData?.filename ?? `${active}-item`);
      a.click();
      toast.success('Download started');
      return;
    }

    const blob = new Blob([buildShareText(list)], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${notebookTitle}-${active}.txt`.replace(/[^\w.-]+/g, '_');
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Saved to device');
  };

  const openSendToNotebook = () => {
    if (!requireSelection()) return;
    const others = localDb
      .listNotebooks(userId)
      .filter((n) => n.id !== notebookId)
      .sort((a, b) => a.title.localeCompare(b.title));
    setOtherNotebooks(others);
    if (others.length === 0) {
      toast.message('No other notebooks yet', {
        description: 'Create another notebook in the Library first.',
      });
      return;
    }
    setSendOpen(true);
  };

  const sendToNotebook = (targetId: string) => {
    const list = requireSelection();
    if (!list) return;
    const target = otherNotebooks.find((n) => n.id === targetId);
    for (const item of list) {
      localDb.addSavedItem({
        userId,
        notebookId: targetId,
        entryId: null,
        category: active,
        content: item.content,
        contentType: item.contentType,
        contentData: item.contentData ?? null,
        completed: item.completed,
      });
    }
    toast.success(`Sent to ${target?.title ?? 'notebook'}`, {
      description: `${list.length} item${list.length === 1 ? '' : 's'} in “${active}”.`,
    });
    setSendOpen(false);
  };

  const deleteSelected = () => {
    const list = requireSelection();
    if (!list) return;
    localDb.deleteSavedItems(list.map((i) => i.id));
    setSelectedIds(new Set());
    refresh();
    toast.success('Deleted');
  };

  const addItem = () => {
    const content = draft.trim();
    if (!content) return;
    localDb.addSavedItem({
      userId,
      notebookId,
      entryId,
      category: active,
      content,
      contentType: 'text',
    });
    setDraft('');
    refresh();
  };

  const toggleComplete = (item: SavedItem) => {
    localDb.updateSavedItem(item.id, { completed: !item.completed });
    refresh();
  };

  const removeItem = (id: string) => {
    localDb.deleteSavedItems([id]);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    refresh();
  };

  const handleFile = (file: File) => {
    const isImage = file.type.startsWith('image/');
    const reader = new FileReader();
    reader.onload = () => {
      localDb.addSavedItem({
        userId,
        notebookId,
        entryId,
        category: active,
        content: String(reader.result ?? ''),
        contentType: isImage ? 'image' : 'file',
        contentData: { filename: file.name },
      });
      refresh();
    };
    reader.readAsDataURL(file);
  };

  const createCategory = () => {
    const name = newCategoryName.trim();
    if (!name) return;
    localDb.addCustomCategory(userId, notebookId, name);
    setNewCategoryName('');
    setAddingCategory(false);
    setActive(name);
    refresh();
  };

  return (
    <div className="flex h-full flex-col">
      <Tabs
        value={active}
        onValueChange={(v) => setActive(v as CategoryKey)}
        className="flex h-full flex-col"
      >
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <TabsList className="h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
            {categories.map((cat) => (
              <TabsTrigger
                key={cat}
                value={cat}
                className="rounded-full border border-border bg-card px-3 py-1 text-xs data-[state=active]:border-moss data-[state=active]:bg-moss/10 data-[state=active]:text-moss data-[state=active]:shadow-none"
              >
                {cat}
              </TabsTrigger>
            ))}
          </TabsList>
          <button
            type="button"
            onClick={() => setAddingCategory((v) => !v)}
            title="Add category"
            className="ml-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground hover:border-moss hover:text-moss"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        {addingCategory && (
          <div className="mt-2 flex items-center gap-2">
            <Input
              autoFocus
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="New category name"
              className="h-8 text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') createCategory();
                if (e.key === 'Escape') setAddingCategory(false);
              }}
            />
            <Button size="sm" onClick={createCategory}>
              Add
            </Button>
          </div>
        )}

        {categories.map((cat) => (
          <TabsContent key={cat} value={cat} className="mt-3 flex-1 overflow-hidden">
            {/* Action toolbar — Notie colors, no Lab */}
            <div className="mb-2 space-y-1.5">
              <p className="text-[10px] text-muted-foreground">
                {selectedItems.length} of {itemsForActive.length} selected
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                <Button type="button" variant="outline" size="sm" className={actionBtn} onClick={selectAll}>
                  Select All
                </Button>
                <Button type="button" variant="outline" size="sm" className={actionBtn} onClick={deselectAll}>
                  Deselect
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                <Button type="button" variant="outline" size="sm" className={actionBtn} onClick={() => void shareSelected()}>
                  <Share2 className="mr-1 h-3 w-3" />
                  Share
                </Button>
                <Button type="button" variant="outline" size="sm" className={actionBtn} onClick={() => void copySelected()}>
                  <ClipboardCopy className="mr-1 h-3 w-3" />
                  Copy
                </Button>
                <Button type="button" variant="outline" size="sm" className={actionBtn} onClick={() => void copyNotebookLink()}>
                  <Link2 className="mr-1 h-3 w-3" />
                  Copy link
                </Button>
                <Button type="button" variant="outline" size="sm" className={actionBtn} onClick={printSelected}>
                  <Printer className="mr-1 h-3 w-3" />
                  Print
                </Button>
                <Button type="button" variant="outline" size="sm" className={actionBtn} onClick={saveToDevice}>
                  <Download className="mr-1 h-3 w-3" />
                  Save to Device
                </Button>
                <Button type="button" variant="outline" size="sm" className={actionBtn} onClick={openSendToNotebook}>
                  <FolderInput className="mr-1 h-3 w-3" />
                  Send to notebook…
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="col-span-2 h-8 text-[11px] text-destructive hover:bg-destructive/10 sm:col-span-3"
                  disabled={selectedItems.length === 0}
                  onClick={deleteSelected}
                >
                  Delete Selected
                </Button>
              </div>
            </div>

            <ScrollArea className="h-full max-h-[28vh] pr-2">
              <div className="space-y-1.5">
                {itemsForActive.length === 0 && (
                  <p className="py-4 text-center text-xs text-muted-foreground">
                    Nothing saved here yet.
                  </p>
                )}
                {itemsForActive.map((item) => {
                  const selected = selectedIds.has(item.id);
                  return (
                    <div
                      key={item.id}
                      className={cn(
                        'group flex items-start gap-2 rounded-md border px-2.5 py-1.5',
                        selected
                          ? 'border-moss/50 bg-moss/5'
                          : 'border-border/70 bg-card/60',
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSelect(item.id)}
                        className={cn(
                          'mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border',
                          selected
                            ? 'border-moss bg-moss text-primary-foreground'
                            : 'border-border bg-card',
                        )}
                        aria-label={selected ? 'Deselect' : 'Select'}
                      >
                        {selected && (
                          <svg className="h-full w-full" fill="none" strokeWidth="3" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                      {isChecklist && (
                        <Checkbox
                          checked={item.completed}
                          onCheckedChange={() => toggleComplete(item)}
                          className="mt-0.5"
                        />
                      )}
                      {item.contentType === 'image' ? (
                        <a href={item.content} target="_blank" rel="noreferrer" className="flex-1">
                          <img
                            src={item.content}
                            alt={String(item.contentData?.filename ?? 'image')}
                            className="max-h-28 rounded-md border border-border object-cover"
                          />
                          <p className="mt-1 truncate text-[11px] text-muted-foreground">
                            {String(item.contentData?.filename ?? '')}
                          </p>
                        </a>
                      ) : item.contentType === 'file' ? (
                        <a
                          href={item.content}
                          download={String(item.contentData?.filename ?? 'file')}
                          className="flex flex-1 items-center gap-2 text-sm text-foreground hover:text-moss"
                        >
                          <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="truncate">
                            {String(item.contentData?.filename ?? 'file')}
                          </span>
                        </a>
                      ) : (
                        <p
                          className={cn(
                            'flex-1 whitespace-pre-wrap text-sm',
                            item.completed && 'text-muted-foreground line-through',
                          )}
                        >
                          {item.content}
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="mt-0.5 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            <div className="mt-2 flex items-center gap-2">
              {isFileCategory ? (
                <label className="flex h-9 flex-1 cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-3 text-xs text-muted-foreground hover:border-moss hover:text-moss">
                  {active === 'Gallery' ? (
                    <ImageIcon className="h-3.5 w-3.5" />
                  ) : (
                    <Paperclip className="h-3.5 w-3.5" />
                  )}
                  Attach {active === 'Gallery' ? 'an image' : 'a file'}
                  <input
                    type="file"
                    accept={active === 'Gallery' ? 'image/*' : undefined}
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFile(file);
                      e.target.value = '';
                    }}
                  />
                </label>
              ) : (
                <>
                  <Input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={isChecklist ? 'Add an item…' : `Add to ${active}…`}
                    className="h-9 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') addItem();
                    }}
                  />
                  <Button size="sm" onClick={addItem} disabled={!draft.trim()}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Send to another notebook</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            {selectedItems.length} item{selectedItems.length === 1 ? '' : 's'} → category “{active}”
          </p>
          <div className="max-h-60 space-y-1.5 overflow-y-auto">
            {otherNotebooks.map((nb) => (
              <button
                key={nb.id}
                type="button"
                onClick={() => sendToNotebook(nb.id)}
                className="flex w-full items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-left text-sm hover:border-moss/50"
              >
                <img
                  src="/notie-mark.png"
                  alt=""
                  className="h-7 w-6 rounded-md bg-sand object-contain ring-1 ring-border"
                />
                <span className="truncate font-medium">{nb.title}</span>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
