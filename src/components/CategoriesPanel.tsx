import { useEffect, useState } from 'react';
import { Plus, Paperclip, X, FileText, Image as ImageIcon } from 'lucide-react';

import { localDb } from '@/lib/localDb';
import { CHECKABLE_CATEGORIES, DEFAULT_CATEGORIES, type CategoryKey, type SavedItem } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';

interface CategoriesPanelProps {
  userId: string;
  notebookId: string;
  entryId: string | null;
  /** Bump when items are saved from outside (e.g. selection dialog). */
  refreshKey?: number;
}

/**
 * Categories: Files, Gallery, Plans, Lists, To Do, plus any custom categories
 * the writer adds. Backed entirely by localDb.savedItems for this notebook.
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

  const refresh = () => {
    setItems(localDb.listSavedItems(notebookId));
    setCustomCategories(localDb.listCustomCategories(notebookId).map((c) => c.name));
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notebookId, refreshKey]);

  const categories: CategoryKey[] = [...DEFAULT_CATEGORIES, ...customCategories];

  const itemsForActive = items.filter((i) => i.category === active);
  const isChecklist = CHECKABLE_CATEGORIES.has(active);
  const isFileCategory = active === 'Files' || active === 'Gallery';

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
      <Tabs value={active} onValueChange={(v) => setActive(v as CategoryKey)} className="flex h-full flex-col">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <TabsList className="h-auto flex-wrap justify-start bg-transparent p-0 gap-1">
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
            <ScrollArea className="h-full max-h-[38vh] pr-2">
              <div className="space-y-1.5">
                {itemsForActive.length === 0 && (
                  <p className="py-4 text-center text-xs text-muted-foreground">Nothing saved here yet.</p>
                )}
                {itemsForActive.map((item) => (
                  <div
                    key={item.id}
                    className="group flex items-start gap-2 rounded-md border border-border/70 bg-card/60 px-2.5 py-1.5"
                  >
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
                        <span className="truncate">{String(item.contentData?.filename ?? 'file')}</span>
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
                ))}
              </div>
            </ScrollArea>

            <div className="mt-2 flex items-center gap-2">
              {isFileCategory ? (
                <label className="flex h-9 flex-1 cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-3 text-xs text-muted-foreground hover:border-moss hover:text-moss">
                  {active === 'Gallery' ? <ImageIcon className="h-3.5 w-3.5" /> : <Paperclip className="h-3.5 w-3.5" />}
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
    </div>
  );
}
