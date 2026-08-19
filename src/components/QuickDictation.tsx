import { Mic } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { useInlineDictation } from '@/hooks/useInlineDictation';
import { dictationToHtml } from '@/lib/dictationPostProcess';
import { localDb } from '@/lib/localDb';
import type { NotebookMeta } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface QuickDictationProps {
  userId: string;
  /** After filing into a notebook, open that writing space. */
  onFiled: (notebookId: string) => void;
}

/**
 * Dashboard short-clip Voice: dictate, then pick a notebook to append into.
 */
export function QuickDictation({ userId, onFiled }: QuickDictationProps) {
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [notebooks, setNotebooks] = useState<NotebookMeta[]>([]);
  const [pickedId, setPickedId] = useState<string>('');

  const { listening, status, startOrFinish, cancel } = useInlineDictation({
    owner: 'dashboard-voice',
    onTranscript: (text) => {
      const list = localDb.listNotebooks(userId);
      setNotebooks(list);
      setPickedId(list[0]?.id ?? '');
      setPendingText(text);
    },
  });

  useEffect(() => {
    return () => cancel();
  }, [cancel]);

  const fileToNotebook = () => {
    if (!pendingText || !pickedId) return;
    const entry = localDb.loadOrCreateOpenEntry(userId, pickedId);
    const chunk = dictationToHtml(pendingText);
    if (!chunk) return;
    const base = (entry.content || '').trim();
    const empty = !base || base === '<p></p>';
    const nextContent = empty ? chunk : `${base}${chunk}`;
    localDb.saveOpenEntryDraft(entry.id, { content: nextContent });
    localDb.writeDraft(userId, pickedId, entry.id, {
      title: entry.title,
      content: nextContent,
      inspiration: entry.inspiration,
    });
    const nb = localDb.getNotebook(pickedId);
    toast.success('Added to notebook', {
      description: nb?.title || 'Open draft updated.',
    });
    setPendingText(null);
    onFiled(pickedId);
  };

  return (
    <>
      <div className="flex flex-col items-end gap-1">
        {status ? (
          <p className="max-w-[11rem] rounded-md border border-border bg-background/95 px-2 py-1 text-[10px] text-muted-foreground shadow-sm backdrop-blur-sm">
            {status}
          </p>
        ) : null}
        <button
          type="button"
          onClick={startOrFinish}
          className={`flex h-10 w-10 items-center justify-center rounded-full border shadow-md backdrop-blur-sm transition-colors ${
            listening
              ? 'border-primary/50 bg-primary text-primary-foreground'
              : 'border-border/80 bg-background/95 text-muted-foreground hover:border-primary/40 hover:text-primary'
          }`}
          aria-label={listening ? 'Stop dictation' : 'Quick voice note'}
          title={listening ? 'Stop' : 'Voice — add to a notebook'}
        >
          <Mic className={`h-5 w-5 ${listening ? 'animate-pulse' : ''}`} />
        </button>
      </div>

      <Dialog
        open={!!pendingText}
        onOpenChange={(open) => {
          if (!open) setPendingText(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add this to a notebook</DialogTitle>
          </DialogHeader>
          <p className="line-clamp-4 text-sm text-muted-foreground">
            {pendingText}
          </p>
          {notebooks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Create a notebook on the Library shelf first, then try again.
            </p>
          ) : (
            <label className="block text-sm">
              <span className="mb-1.5 block text-muted-foreground">Notebook</span>
              <select
                value={pickedId}
                onChange={(e) => setPickedId(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {notebooks.map((nb) => (
                  <option key={nb.id} value={nb.id}>
                    {nb.title}
                  </option>
                ))}
              </select>
            </label>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setPendingText(null)}>
              Discard
            </Button>
            <Button onClick={fileToNotebook} disabled={!pickedId || !pendingText}>
              Add &amp; open
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
