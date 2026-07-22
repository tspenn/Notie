import { useEffect, useState } from 'react';
import { Archive, CalendarDays, Library as LibraryIcon, Search, Settings2, StickyNote } from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import {
  calendarLink,
  dashboardLink,
  navigateTo,
  notebookLink,
  parseDeepLink,
  searchLink,
} from '@/lib/deepLinks';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Library } from '@/components/Library';
import { CalendarView } from '@/components/CalendarView';
import { NoteToSelf } from '@/components/NoteToSelf';
import { Notebook } from '@/components/Notebook';
import { GlobalSearch } from '@/components/GlobalSearch';
import { Settings } from '@/components/Settings';
import { ArchiveView } from '@/components/ArchiveView';

type MainTab = 'library' | 'calendar' | 'notes';

export function Dashboard() {
  const { userId, displayName } = useAuth();
  const [tab, setTab] = useState<MainTab>('library');
  const [openNotebookId, setOpenNotebookId] = useState<string | null>(null);
  const [openEntryId, setOpenEntryId] = useState<string | undefined>();
  const [libraryRefreshKey, setLibraryRefreshKey] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const bumpLibrary = () => setLibraryRefreshKey((k) => k + 1);

  useEffect(() => {
    const apply = () => {
      const route = parseDeepLink();
      if (route.type === 'calendar') setTab('calendar');
      else if (route.type === 'search') {
        setSearchOpen(true);
        setTab('library');
      } else if (route.type === 'notebook') {
        setOpenNotebookId(route.notebookId);
        setOpenEntryId(undefined);
      } else if (route.type === 'entry') {
        setOpenNotebookId(route.notebookId);
        setOpenEntryId(route.entryId);
      } else {
        setTab('library');
      }
    };
    apply();
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, []);

  if (!userId) return null;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-border/80 bg-sand/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <img
            src="/notie-icon.jpg"
            alt=""
            className="h-9 w-9 rounded-full object-cover ring-1 ring-border"
          />
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-semibold leading-none text-foreground">Notie</p>
            <p className="truncate text-xs text-muted-foreground">{displayName}</p>
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
            <Library
              userId={userId}
              refreshKey={libraryRefreshKey}
              onOpenNotebook={(id) => {
                setOpenNotebookId(id);
                setOpenEntryId(undefined);
                navigateTo(notebookLink(id).replace(/^#/, ''));
              }}
            />
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
            setOpenNotebookId(null);
            setOpenEntryId(undefined);
            bumpLibrary();
            navigateTo(dashboardLink().replace(/^#/, ''));
          }}
        />
      )}

      <GlobalSearch
        userId={userId}
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onOpenNotebook={(id) => {
          setSearchOpen(false);
          setOpenNotebookId(id);
          setOpenEntryId(undefined);
          navigateTo(notebookLink(id).replace(/^#/, ''));
        }}
        onOpenEntry={(notebookId, entryId) => {
          setSearchOpen(false);
          setOpenNotebookId(notebookId);
          setOpenEntryId(entryId);
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
