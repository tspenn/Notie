import { useEffect, useMemo, useState } from 'react';
import { Command } from 'cmdk';
import { BookOpen, FileText, ListChecks, NotebookPen, Search } from 'lucide-react';

import { localDb } from '@/lib/localDb';
import { stripHtml } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface GlobalSearchProps {
  userId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenNotebook: (notebookId: string) => void;
  onOpenEntry: (notebookId: string, entryId: string) => void;
}

export function GlobalSearch({
  userId,
  open,
  onOpenChange,
  onOpenNotebook,
  onOpenEntry,
}: GlobalSearchProps) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const results = useMemo(() => localDb.searchAll(userId, query), [userId, query]);
  const hasResults =
    results.notebooks.length + results.entries.length + results.savedItems.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="sr-only">
          <DialogTitle>Search Notie</DialogTitle>
        </DialogHeader>
        <Command label="Search Notie" shouldFilter={false} className="bg-card">
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Search notebooks, entries, and saved items…"
              className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <Command.List className="max-h-[60vh] overflow-y-auto p-2">
            {query.trim() === '' ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                Start typing to search across your entire Library.
              </p>
            ) : !hasResults ? (
              <Command.Empty className="px-2 py-6 text-center text-sm text-muted-foreground">
                Nothing found for “{query}”.
              </Command.Empty>
            ) : (
              <>
                {results.notebooks.length > 0 && (
                  <Command.Group heading="Notebooks">
                    {results.notebooks.map((nb) => (
                      <Command.Item
                        key={nb.id}
                        value={`notebook-${nb.id}`}
                        onSelect={() => {
                          onOpenChange(false);
                          onOpenNotebook(nb.id);
                        }}
                        className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm aria-selected:bg-moss/10"
                      >
                        <NotebookPen className="h-4 w-4 shrink-0 text-moss-soft" />
                        <span className="truncate">{nb.title}</span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}
                {results.entries.length > 0 && (
                  <Command.Group heading="Entries">
                    {results.entries.map((entry) => (
                      <Command.Item
                        key={entry.id}
                        value={`entry-${entry.id}`}
                        onSelect={() => {
                          onOpenChange(false);
                          onOpenEntry(entry.notebookId, entry.id);
                        }}
                        className="flex cursor-pointer flex-col items-start gap-0.5 rounded-md px-2 py-2 text-sm aria-selected:bg-moss/10"
                      >
                        <span className="flex items-center gap-2">
                          <BookOpen className="h-4 w-4 shrink-0 text-moss-soft" />
                          {entry.title}
                        </span>
                        <span className="line-clamp-1 pl-6 text-xs text-muted-foreground">
                          {stripHtml(entry.content)}
                        </span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}
                {results.savedItems.length > 0 && (
                  <Command.Group heading="Saved items">
                    {results.savedItems.map((item) => (
                      <Command.Item
                        key={item.id}
                        value={`item-${item.id}`}
                        onSelect={() => {
                          onOpenChange(false);
                          onOpenNotebook(item.notebookId);
                        }}
                        className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm aria-selected:bg-moss/10"
                      >
                        {item.contentType === 'file' || item.contentType === 'image' ? (
                          <FileText className="h-4 w-4 shrink-0 text-moss-soft" />
                        ) : (
                          <ListChecks className="h-4 w-4 shrink-0 text-moss-soft" />
                        )}
                        <span className="truncate">
                          {item.category}: {item.content.slice(0, 60)}
                        </span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}
              </>
            )}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
