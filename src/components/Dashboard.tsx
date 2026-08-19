import { useCallback, useEffect, useState } from 'react';
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
import { localDb } from '@/lib/localDb';
import {
  addDoorSideNote,
  archiveAllLiveDoors,
  loadSessionDoors,
  touchSessionDoor,
  type SessionDoor,
} from '@/lib/openSessionStack';
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
import { OpenSessionStack } from '@/components/OpenSessionStack';
import { brandHeaderClass } from '@/lib/brand';

type MainTab = 'library' | 'calendar' | 'notes';

function doorMeta(notebookId: string, entryId?: string | null) {
  const notebook = localDb.getNotebook(notebookId);
  const notebookTitle = notebook?.title || 'Notebook';
  if (entryId) {
    const entry = localDb.getEntry(entryId);
    return {
      notebookTitle,
      entryId,
      entryLabel: entry?.title?.trim() || 'Tab',
    };
  }
  const open = localDb.getOpenEntry(notebookId);
  return {
    notebookTitle,
    entryId: null as string | null,
    entryLabel: open?.title?.trim() || 'Open draft',
  };
}

function resolveDoorEntryId(door: SessionDoor): string | null {
  if (door.entryId) return door.entryId;
  return localDb.getOpenEntry(door.notebookId)?.id ?? null;
}

export function Dashboard() {
  const { userId, displayName } = useAuth();
  const [tab, setTab] = useState<MainTab>('library');
  const [entryListId, setEntryListId] = useState<string | null>(null);
  const [openNotebookId, setOpenNotebookId] = useState<string | null>(null);
  const [openEntryId, setOpenEntryId] = useState<string | undefined>();
  const [notebookMountKey, setNotebookMountKey] = useState(0);
  const [libraryRefreshKey, setLibraryRefreshKey] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [sessionDoors, setSessionDoors] = useState<SessionDoor[]>([]);

  const bumpLibrary = () => setLibraryRefreshKey((k) => k + 1);

  const refreshDoors = useCallback(() => {
    if (!userId) return;
    setSessionDoors(loadSessionDoors(userId));
  }, [userId]);

  useEffect(() => {
    refreshDoors();
  }, [refreshDoors]);

  const recordVisit = useCallback(
    (notebookId: string, entryId?: string) => {
      if (!userId) return;
      const meta = doorMeta(notebookId, entryId);
      setSessionDoors(
        touchSessionDoor(userId, {
          notebookId,
          notebookTitle: meta.notebookTitle,
          entryId: meta.entryId,
          entryLabel: meta.entryLabel,
        }),
      );
    },
    [userId],
  );

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
    setNotebookMountKey((k) => k + 1);
    recordVisit(notebookId, entryId);
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
        setNotebookMountKey((k) => k + 1);
        if (userId) {
          const meta = doorMeta(route.notebookId);
          setSessionDoors(
            touchSessionDoor(userId, {
              notebookId: route.notebookId,
              notebookTitle: meta.notebookTitle,
              entryId: null,
              entryLabel: meta.entryLabel,
            }),
          );
        }
      } else if (route.type === 'entry') {
        setTab('library');
        setEntryListId(route.notebookId);
        setOpenNotebookId(route.notebookId);
        setOpenEntryId(route.entryId);
        setNotebookMountKey((k) => k + 1);
        if (userId) {
          const meta = doorMeta(route.notebookId, route.entryId);
          setSessionDoors(
            touchSessionDoor(userId, {
              notebookId: route.notebookId,
              notebookTitle: meta.notebookTitle,
              entryId: meta.entryId,
              entryLabel: meta.entryLabel,
            }),
          );
        }
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
  }, [userId]);

  const appendJotIfPossible = (door: SessionDoor, text: string) => {
    const note = text.trim();
    if (!note) return;
    const targetId = resolveDoorEntryId(door);
    if (!targetId) return;
    localDb.appendEntryJot(targetId, note);
    const openMatches =
      openNotebookId === door.notebookId &&
      (openEntryId
        ? openEntryId === targetId
        : !door.entryId || door.entryId === targetId);
    if (openMatches) setNotebookMountKey((k) => k + 1);
  };

  if (!userId) return null;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className={brandHeaderClass}>
        <div className="mx-auto flex min-h-16 max-w-6xl items-center gap-2 px-4 py-2 sm:px-6 md:min-h-[125px] md:gap-3 md:py-2">
          <NotieMark size="header" />
          <div className="min-w-0 flex-1">
            <p className="notie-wordmark text-2xl leading-none text-foreground md:text-4xl">
              Notie
            </p>
            <p className="mt-0.5 truncate text-sm text-muted-foreground md:mt-1 md:text-base">
              {displayName}
            </p>
            <p className="mt-0.5 text-xs tracking-wide text-muted-foreground/80 md:mt-1 md:text-sm">
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
            <Search className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Archive"
            onClick={() => setArchiveOpen(true)}
          >
            <Archive className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Settings"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings2 className="h-5 w-5" />
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
              <LibraryIcon className="h-4 w-4" />
              Library
            </TabsTrigger>
            <TabsTrigger value="calendar" className="gap-1.5">
              <CalendarDays className="h-4 w-4" />
              Calendar
            </TabsTrigger>
            <TabsTrigger value="notes" className="gap-1.5">
              <StickyNote className="h-4 w-4" />
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
          key={`${openNotebookId}:${openEntryId ?? 'draft'}:${notebookMountKey}`}
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

      <div className="fixed bottom-5 right-4 z-[60] sm:bottom-6 sm:right-6">
        <OpenSessionStack
          doors={sessionDoors}
          onOpen={(door) => {
            openWritingSpace(door.notebookId, door.entryId ?? undefined);
          }}
          onArchiveLive={() => {
            setSessionDoors(archiveAllLiveDoors(userId));
          }}
          onSideNote={(door, text) => {
            setSessionDoors(addDoorSideNote(userId, door, text));
            appendJotIfPossible(door, text);
          }}
          onExpandNote={(door, text) => {
            if (text.trim()) {
              setSessionDoors(addDoorSideNote(userId, door, text));
              appendJotIfPossible(door, text);
            }
            openWritingSpace(door.notebookId, door.entryId ?? undefined);
          }}
        />
      </div>

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
