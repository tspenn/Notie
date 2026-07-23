import { useEffect, useState } from 'react';
import { Archive, CalendarDays, Library as LibraryIcon, Search, Settings2, StickyNote } from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import {
  calendarLink,
  dashboardLink,
  entriesLink,
  navigateTo,
  notebookLink,
  parseDeepLink,
  searchLink,
} from '@/lib/deepLinks';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Library } from '@/components/Library';
import { EntryList } from '@/components/EntryList';
import { CalendarView } from '@/components/CalendarView';
import { NoteToSelf } from '@/components/NoteToSelf';
import { Notebook } from '@/components/Notebook';
import { GlobalSearch } from '@/components/GlobalSearch';
import { Settings } from '@/components/Settings';
import { ArchiveView } from '@/components/ArchiveView';
import { NotieMark } from '@/components/NotieMark';
import { brandHeaderClass } from '@/lib/brand';

type MainTab = 'library' | 'calendar' | 'notes';

export function Dashboard() {
  const { userId, displayName } = useAuth();
  const [tab, setTab] = useState<MainTab>('library');
  const [entryListId, setEntryListId] = useState<string | null>(null);
  const [openNotebookId, setOpenNotebookId] = useState<string | null>(null);
  const [openEntryId, setOpenEntryId] = useState<string | undefined>();
  const [libraryRefreshKey, setLibraryRefreshKey] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const bumpLibrary = () => setLibraryRefreshKey((k) => k + 1);

  const openEntryList = (id: string) => {
    setEntryListId(id);
    setOpenNotebookId(null);
    setOpenEntryId(undefined);
    setTab('library');
    navigateTo(entriesLink(id).replace(/^#/, ''));
  };

  const openWritingSpace = (notebookId: string, entryId?: string) => {
    setEntryListId(notebookId);
    setOpenNotebookId(notebookId);
    setOpenEntryId(entryId);
    navigateTo(
      entryId
        ? `#/notebook/${encodeURIComponent(notebookId)}/entry/${encodeURIComponent(entryId)}`.replace(
            /^#/,
            '',
          )
        : notebookLink(notebookId).replace(/^#/, ''),
    );
  };

  useEffect(() => {
    const apply = () => {
      const route = parseDeepLink();
      if (route.type === 'calendar') {
        setTab('calendar');
        setEntryListId(null);
        setOpenNotebookId(null);
      } else if (route.type === 'search') {
        setSearchOpen(true);
        setTab('library');
      } else if (route.type === 'entries') {
        setTab('library');
        setEntryListId(route.notebookId);
        setOpenNotebookId(null);
        setOpenEntryId(undefined);
      } else if (route.type === 'notebook') {
        setTab('library');
        setEntryListId(route.notebookId);
        setOpenNotebookId(route.notebookId);
        setOpenEntryId(undefined);
      } else if (route.type === 'entry') {
        setTab('library');
        setEntryListId(route.notebookId);
        setOpenNotebookId(route.notebookId);
        setOpenEntryId(route.entryId);
      } else {
        setTab('library');
        setEntryListId(null);
        setOpenNotebookId(null);
        setOpenEntryId(undefined);
      }
    };
    apply();
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, []);

  if (!userId) return null;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className={brandHeaderClass}>
        <div className="mx-auto flex min-h-16 max-w-6xl items-center gap-2 px-4 py-2 sm:px-6 md:min-h-[125px] md:gap-3 md:py-2">
          <NotieMark size="header" />
          <div className="min-w-0 flex-1">
            <p className="notie-wordmark text-xl leading-none text-foreground md:text-3xl">
              Notie
            </p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground md:mt-1 md:text-sm">
              {displayName}
            </p>
            <p className="mt-0.5 text-[10px] tracking-wide text-muted-foreground/80 md:mt-1 md:text-xs">
              A Skyland Apps product
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Search"
            onClick={() => {
              setSearchOpen(true);
              navigateTo(searchLink().replace(/^#/, ''));
            }}
          >
            <Search className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Archive"
            onClick={() => setArchiveOpen(true)}
          >
            <Archive className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Settings"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings2 className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 sm:px-6">
        <Tabs
          value={tab}
          onValueChange={(v) => {
            const next = v as MainTab;
            setTab(next);
            setEntryListId(null);
            setOpenNotebookId(null);
            setOpenEntryId(undefined);
            if (next === 'calendar') navigateTo(calendarLink().replace(/^#/, ''));
            else navigateTo(dashboardLink().replace(/^#/, ''));
          }}
        >
          <TabsList className="mb-5">
            <TabsTrigger value="library" className="gap-1.5">
              <LibraryIcon className="h-3.5 w-3.5" />
              Library
            </TabsTrigger>
            <TabsTrigger value="calendar" className="gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              Calendar
            </TabsTrigger>
            <TabsTrigger value="notes" className="gap-1.5">
              <StickyNote className="h-3.5 w-3.5" />
              Note to self
            </TabsTrigger>
          </TabsList>

          <TabsContent value="library">
            {entryListId ? (
              <EntryList
                userId={userId}
                notebookId={entryListId}
                refreshKey={libraryRefreshKey}
                onBack={() => {
                  setEntryListId(null);
                  navigateTo(dashboardLink().replace(/^#/, ''));
                }}
                onOpenNotebook={() => openWritingSpace(entryListId)}
                onOpenEntry={(entryId) => openWritingSpace(entryListId, entryId)}
              />
            ) : (
              <Library
                userId={userId}
                refreshKey={libraryRefreshKey}
                onOpenBook={openEntryList}
              />
            )}
          </TabsContent>
          <TabsContent value="calendar">
            <CalendarView userId={userId} />
          </TabsContent>
          <TabsContent value="notes">
            <NoteToSelf userId={userId} />
          </TabsContent>
        </Tabs>
      </main>

      {openNotebookId && (
        <Notebook
          userId={userId}
          notebookId={openNotebookId}
          initialEntryId={openEntryId}
          onEntrySaved={bumpLibrary}
          onClose={() => {
            const listId = openNotebookId;
            setOpenNotebookId(null);
            setOpenEntryId(undefined);
            bumpLibrary();
            setEntryListId(listId);
            navigateTo(entriesLink(listId).replace(/^#/, ''));
          }}
        />
      )}

      <GlobalSearch
        userId={userId}
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onOpenNotebook={(id) => {
          setSearchOpen(false);
          openEntryList(id);
        }}
        onOpenEntry={(notebookId, entryId) => {
          setSearchOpen(false);
          openWritingSpace(notebookId, entryId);
        }}
      />

      <Settings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onOpenArchive={() => {
          setSettingsOpen(false);
          setArchiveOpen(true);
        }}
        onOpenCalendar={() => {
          setSettingsOpen(false);
          setTab('calendar');
          navigateTo(calendarLink().replace(/^#/, ''));
        }}
      />

      {archiveOpen && (
        <ArchiveView
          userId={userId}
          onBack={() => setArchiveOpen(false)}
        />
      )}
    </div>
  );
}
