import { useEffect, useState } from 'react';
import { ArrowLeft, Archive as ArchiveIcon, RotateCcw, Trash2 } from 'lucide-react';

import { localDb } from '@/lib/localDb';
import type { NotebookMeta } from '@/lib/types';
import { formatShortDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface ArchiveViewProps {
  userId: string;
  onBack: () => void;
}

export function ArchiveView({ userId, onBack }: ArchiveViewProps) {
  const [notebooks, setNotebooks] = useState<NotebookMeta[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const refresh = () =>
    setNotebooks(localDb.listNotebooks(userId, true).filter((n) => n.isArchived));

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const restore = (id: string) => {
    localDb.updateNotebook(id, { isArchived: false });
    refresh();
  };

  const remove = (id: string) => {
    localDb.deleteNotebook(id);
    setConfirmDeleteId(null);
    refresh();
  };

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-background">
      <header className="sticky top-0 flex items-center gap-3 border-b border-border bg-card/70 px-4 py-3 backdrop-blur-sm sm:px-6">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <ArchiveIcon className="h-4 w-4 text-moss-soft" />
        <div>
          <h2 className="font-display text-lg font-semibold text-foreground">Archive</h2>
          <p className="text-xs text-muted-foreground">
            {notebooks.length} archived notebook{notebooks.length === 1 ? '' : 's'}
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-2xl space-y-3 p-4 sm:p-6">
        {notebooks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <ArchiveIcon className="h-10 w-10 text-muted-foreground/50" />
            <p className="mt-4 font-display text-lg text-foreground">Nothing archived</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Notebooks you archive from the Library will appear here and can be restored anytime.
            </p>
          </div>
        ) : (
          notebooks.map((nb) => {
            return (
              <div
                key={nb.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-card/70 px-4 py-3 shadow-sm"
              >
                <img
                  src="/notie-icon.jpg"
                  alt=""
                  className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-border"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-base font-semibold text-foreground">{nb.title}</p>
                  <p className="text-xs text-muted-foreground">Archived · updated {formatShortDate(nb.updatedAt)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button size="sm" onClick={() => restore(nb.id)}>
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                    Restore
                  </Button>
                  {confirmDeleteId === nb.id ? (
                    <Button size="sm" variant="destructive" onClick={() => remove(nb.id)}>
                      Confirm delete
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setConfirmDeleteId(nb.id)}>
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
