import { useEffect, useState } from 'react';
import { Mail, Tags } from 'lucide-react';
import { toast } from 'sonner';

import { localDb } from '@/lib/localDb';
import { CHECKABLE_CATEGORIES, DEFAULT_CATEGORIES, type CategoryKey } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
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
 * Opens when the writer highlights text in Notebook.
 * Choose a category to save into, or Share via email (body = selection).
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
  const [picked, setPicked] = useState<CategoryKey | null>(null);

  useEffect(() => {
    if (!open) return;
    const custom = localDb.listCustomCategories(notebookId).map((c) => c.name);
    setCategories([...DEFAULT_CATEGORIES, ...custom]);
    setPicked(null);
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

  const shareEmail = () => {
    if (!text) return;
    const href = `mailto:?body=${encodeURIComponent(text)}`;
    window.location.href = href;
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Selected text</DialogTitle>
        </DialogHeader>

        <p className="rounded-md bg-secondary/50 px-3 py-2 text-sm leading-relaxed text-foreground">
          “{preview}”
        </p>

        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Tags className="h-3.5 w-3.5" />
            Save to category
          </p>
          <div className="flex flex-wrap gap-1.5">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setPicked(cat)}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  picked === cat
                    ? 'border-moss bg-moss/10 text-moss'
                    : 'border-border bg-card text-foreground hover:border-moss/50'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <Button type="button" variant="outline" onClick={shareEmail} className="w-full sm:w-auto">
            <Mail className="mr-1.5 h-3.5 w-3.5" />
            Share
          </Button>
          <div className="flex w-full gap-2 sm:w-auto">
            <Button
              type="button"
              variant="ghost"
              className="flex-1 sm:flex-none"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="flex-1 sm:flex-none"
              disabled={!picked}
              onClick={() => picked && saveToCategory(picked)}
            >
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
