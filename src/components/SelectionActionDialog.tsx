import { useEffect, useState } from 'react';
import { Mail, Plus } from 'lucide-react';
import { toast } from 'sonner';

import { localDb } from '@/lib/localDb';
import { CHECKABLE_CATEGORIES, DEFAULT_CATEGORIES, type CategoryKey } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface SelectionActionDialogProps {
  open: boolean;
  selectedText: string;
  userId: string;
  notebookId: string;
  entryId: string | null;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

/**
 * Highlight text in Notebook → pick Files / Gallery / Plans / Lists / To Do / +More.
 * One tap saves into that notebook-scoped category and returns to writing.
 */
export function SelectionActionDialog({
  open,
  selectedText,
  userId,
  notebookId,
  entryId,
  onOpenChange,
  onSaved,
}: SelectionActionDialogProps) {
  const [categories, setCategories] = useState<CategoryKey[]>([...DEFAULT_CATEGORIES]);
  const [addingMore, setAddingMore] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    if (!open) return;
    const custom = localDb.listCustomCategories(notebookId).map((c) => c.name);
    setCategories([...DEFAULT_CATEGORIES, ...custom]);
    setAddingMore(false);
    setNewName('');
  }, [open, notebookId]);

  const text = selectedText.trim();
  const preview = text.length > 160 ? `${text.slice(0, 160).trimEnd()}…` : text;

  const saveToCategory = (category: CategoryKey) => {
    if (!text) return;
    const isCheckable = CHECKABLE_CATEGORIES.has(category);
    if (isCheckable) {
      const lines = text
        .split(/\r?\n/)
        .map((l) => l.replace(/^[-*•]\s+/, '').trim())
        .filter(Boolean);
      for (const line of lines.length ? lines : [text]) {
        localDb.addSavedItem({
          userId,
          notebookId,
          entryId,
          category,
          content: line,
          contentType: 'text',
        });
      }
    } else {
      localDb.addSavedItem({
        userId,
        notebookId,
        entryId,
        category,
        content: text,
        contentType: 'text',
      });
    }
    toast.success(`Saved to ${category}`);
    onSaved?.();
    onOpenChange(false);
  };

  const saveToNewCategory = () => {
    const name = newName.trim();
    if (!name) return;
    localDb.addCustomCategory(userId, notebookId, name);
    saveToCategory(name);
  };

  const shareEmail = () => {
    if (!text) return;
    window.location.href = `mailto:?body=${encodeURIComponent(text)}`;
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Save selection</DialogTitle>
        </DialogHeader>

        <p className="rounded-md bg-secondary/50 px-3 py-2 text-sm leading-relaxed text-foreground">
          “{preview}”
        </p>

        <div className="flex flex-wrap gap-1.5">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => saveToCategory(cat)}
              className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-foreground transition hover:border-moss hover:bg-moss/10 hover:text-moss"
            >
              {cat}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setAddingMore((v) => !v)}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground transition hover:border-moss hover:text-moss"
          >
            <Plus className="h-3 w-3" />
            More
          </button>
        </div>

        {addingMore && (
          <div className="flex items-center gap-2">
            <Input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Your category name"
              className="h-9 text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveToNewCategory();
                if (e.key === 'Escape') setAddingMore(false);
              }}
            />
            <Button size="sm" disabled={!newName.trim()} onClick={saveToNewCategory}>
              Save
            </Button>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" onClick={shareEmail}>
            <Mail className="mr-1.5 h-3.5 w-3.5" />
            Share
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
