import {
  type CalendarEvent,
  type Entry,
  type IcsFeedSettings,
  type NotebookMeta,
  type NotebookShelfData,
  type NoteToSelf,
  type NotieStore,
  type PlanKey,
  type ProgressRow,
  type SavedItem,
  type UserProfile,
  getBarHeight,
  pickBookColor,
} from './types';
import { stripHtml, uid } from './utils';

const STORAGE_KEY = 'notie_local_db_v2';
const LEGACY_KEY = 'notie_local_db_v1';

function icsSettingsKey(userId: string): string {
  return `notie_ics_feed:${userId}`;
}

function draftKey(userId: string, notebookId: string, entryId: string): string {
  return `notie_entry_draft::${userId}::${notebookId}::${entryId}`;
}

function emptyStore(): NotieStore {
  return {
    version: 2,
    profile: null,
    notebooks: [],
    entries: [],
    progressRows: [],
    savedItems: [],
    events: [],
    notesToSelf: [],
    customCategories: [],
  };
}

function nowIso(): string {
  return new Date().toISOString();
}

function getLocalDateKey(input: string | Date): string {
  const d = input instanceof Date ? input : new Date(input);
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function migrateV1(raw: unknown): NotieStore {
  const old = raw as {
    profile?: UserProfile | null;
    notebooks?: Array<NotebookMeta & { inspiration?: string }>;
    entries?: Entry[];
    savedItems?: SavedItem[];
    events?: CalendarEvent[];
    notesToSelf?: NoteToSelf[];
    customCategories?: NotieStore['customCategories'];
  };
  const store = emptyStore();
  store.profile = old.profile ?? null;
  store.notebooks = (old.notebooks ?? []).map((n) => ({
    id: n.id,
    userId: n.userId,
    title: n.title,
    colorIndex: n.colorIndex ?? 0,
    isArchived: n.isArchived ?? false,
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
  }));
  store.entries = (old.entries ?? []).map((e) => ({
    ...e,
    inspiration: (e as Entry).inspiration ?? '',
    writingMinutes: (e as Entry).writingMinutes ?? 0,
  }));
  store.savedItems = old.savedItems ?? [];
  store.events = old.events ?? [];
  store.notesToSelf = old.notesToSelf ?? [];
  store.customCategories = old.customCategories ?? [];

  // Seed progress rows from archived entries so existing libraries get bars.
  for (const e of store.entries.filter((x) => x.isArchived)) {
    store.progressRows.push({
      id: uid('prog'),
      userId: e.userId,
      notebookId: e.notebookId,
      title: e.title || 'Saved entry',
      summary: stripHtml(e.content).slice(0, 280),
      inspiration: e.inspiration || '',
      investmentMinutes: Math.max(1, e.writingMinutes || 5),
      entryId: e.id,
      createdAt: e.updatedAt || e.createdAt,
    });
  }
  return store;
}

function read(): NotieStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as NotieStore;
      if (parsed?.version === 2) return parsed;
    }
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const migrated = migrateV1(JSON.parse(legacy));
      write(migrated);
      return migrated;
    }
    return emptyStore();
  } catch {
    return emptyStore();
  }
}

function write(store: NotieStore): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export interface EntryDraft {
  content: string;
  title: string;
  inspiration: string;
  savedAt: string;
}

export const localDb = {
  getStore(): NotieStore {
    return read();
  },

  getProfile(): UserProfile | null {
    return read().profile;
  },

  ensureLocalProfile(plan: PlanKey = 'one_device'): UserProfile {
    const store = read();
    if (store.profile) return store.profile;
    const profile: UserProfile = {
      id: uid('user'),
      email: 'local@notie.app',
      displayName: 'Writer',
      plan,
      welcomeCompletedAt: null,
      createdAt: nowIso(),
    };
    store.profile = profile;
    write(store);
    return profile;
  },

  setPlan(plan: PlanKey): void {
    const store = read();
    if (!store.profile) return;
    store.profile.plan = plan;
    write(store);
  },

  completeWelcome(): void {
    const store = read();
    if (!store.profile) return;
    store.profile.welcomeCompletedAt = nowIso();
    write(store);
  },

  signOutLocal(): void {
    localStorage.removeItem('notie_local_session');
  },

  startLocalSession(): UserProfile {
    const profile = this.ensureLocalProfile();
    localStorage.setItem('notie_local_session', profile.id);
    return profile;
  },

  hasLocalSession(): boolean {
    return Boolean(localStorage.getItem('notie_local_session'));
  },

  listNotebooks(userId: string, includeArchived = false): NotebookMeta[] {
    return read()
      .notebooks.filter((n) => n.userId === userId && (includeArchived || !n.isArchived))
      .sort((a, b) => a.title.localeCompare(b.title));
  },

  getNotebook(notebookId: string): NotebookMeta | null {
    return read().notebooks.find((n) => n.id === notebookId) ?? null;
  },

  createNotebook(userId: string, title: string): NotebookMeta {
    const store = read();
    const name = title.trim() || 'Untitled notebook';
    const now = nowIso();
    const notebook: NotebookMeta = {
      id: uid('nb'),
      userId,
      title: name,
      colorIndex: store.notebooks.length % 8,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    };
    store.notebooks.push(notebook);

    // First canvas ledger stub (0 minutes) — like NewProjectDialog.
    store.progressRows.push({
      id: uid('prog'),
      userId,
      notebookId: notebook.id,
      title: name,
      summary: 'First entry',
      inspiration: '',
      investmentMinutes: 0,
      entryId: null,
      createdAt: now,
    });

    const entry: Entry = {
      id: uid('entry'),
      userId,
      notebookId: notebook.id,
      title: 'First entry',
      content: '<p></p>',
      inspiration: '',
      isArchived: false,
      writingMinutes: 0,
      createdAt: now,
      updatedAt: now,
    };
    store.entries.push(entry);
    write(store);
    return notebook;
  },

  updateNotebook(
    notebookId: string,
    patch: Partial<Pick<NotebookMeta, 'title' | 'isArchived' | 'colorIndex'>>,
  ): NotebookMeta | null {
    const store = read();
    const nb = store.notebooks.find((n) => n.id === notebookId);
    if (!nb) return null;
    Object.assign(nb, patch, { updatedAt: nowIso() });
    write(store);
    return nb;
  },

  deleteNotebook(notebookId: string): void {
    const store = read();
    store.notebooks = store.notebooks.filter((n) => n.id !== notebookId);
    store.entries = store.entries.filter((e) => e.notebookId !== notebookId);
    store.progressRows = store.progressRows.filter((p) => p.notebookId !== notebookId);
    store.savedItems = store.savedItems.filter((s) => s.notebookId !== notebookId);
    store.customCategories = store.customCategories.filter((c) => c.notebookId !== notebookId);
    write(store);
  },

  /** Shelf data for Library bars — Canvas buildProjectData equivalent. */
  listShelf(userId: string): NotebookShelfData[] {
    const store = read();
    const today = getLocalDateKey(new Date());
    return store.notebooks
      .filter((n) => n.userId === userId && !n.isArchived)
      .map((notebook) => {
        const rows = store.progressRows.filter((p) => p.notebookId === notebook.id);
        const totalMinutes = rows.reduce((sum, r) => sum + Math.max(0, r.investmentMinutes), 0);
        const todayMinutes = rows
          .filter((r) => getLocalDateKey(r.createdAt) === today)
          .reduce((sum, r) => sum + Math.max(0, r.investmentMinutes), 0);
        const open = store.entries
          .filter((e) => e.notebookId === notebook.id && !e.isArchived)
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
        const previousEntry =
          store.entries
            .filter((e) => e.notebookId === notebook.id && e.isArchived)
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
        const lastProgress = [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
        const inspiration = open?.inspiration || lastProgress?.inspiration || '';
        const color = pickBookColor(notebook.title);
        return {
          notebook,
          totalMinutes,
          todayMinutes,
          barHeight: getBarHeight(totalMinutes),
          previousEntry,
          inspiration,
          openEntryId: open?.id ?? null,
          color,
        };
      })
      .sort((a, b) => a.notebook.title.localeCompare(b.notebook.title));
  },

  getOpenEntry(notebookId: string): Entry | null {
    return (
      read()
        .entries.filter((e) => e.notebookId === notebookId && !e.isArchived)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null
    );
  },

  getPreviousEntry(notebookId: string, excludeId?: string): Entry | null {
    return (
      read()
        .entries.filter(
          (e) =>
            e.notebookId === notebookId &&
            e.isArchived &&
            (!excludeId || e.id !== excludeId),
        )
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null
    );
  },

  listEntries(notebookId: string): Entry[] {
    return read()
      .entries.filter((e) => e.notebookId === notebookId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  getEntry(entryId: string): Entry | null {
    return read().entries.find((e) => e.id === entryId) ?? null;
  },

  /**
   * Canvas loadOrCreateSession: one open entry per notebook.
   * Prefer local draft when newer/richer than stored open entry.
   */
  loadOrCreateOpenEntry(userId: string, notebookId: string): Entry {
    const store = read();
    let open = store.entries
      .filter((e) => e.notebookId === notebookId && !e.isArchived)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];

    if (!open) {
      const previous = this.getPreviousEntry(notebookId);
      const lastProgress = store.progressRows
        .filter((p) => p.notebookId === notebookId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      const now = nowIso();
      open = {
        id: uid('entry'),
        userId,
        notebookId,
        title: previous ? `Continued from ${previous.title}` : 'New entry',
        content: '<p></p>',
        inspiration: previous?.inspiration || lastProgress?.inspiration || '',
        isArchived: false,
        writingMinutes: 0,
        createdAt: now,
        updatedAt: now,
      };
      store.entries.push(open);
      write(store);
    }

    const draft = this.readDraft(userId, notebookId, open.id);
    if (draft && this.shouldPreferLocalDraft(draft, open)) {
      return {
        ...open,
        content: draft.content,
        title: draft.title || open.title,
        inspiration: draft.inspiration ?? open.inspiration,
      };
    }
    return open;
  },

  readDraft(userId: string, notebookId: string, entryId: string): EntryDraft | null {
    try {
      const raw = localStorage.getItem(draftKey(userId, notebookId, entryId));
      if (!raw) return null;
      return JSON.parse(raw) as EntryDraft;
    } catch {
      return null;
    }
  },

  writeDraft(userId: string, notebookId: string, entryId: string, draft: Omit<EntryDraft, 'savedAt'>): void {
    const payload: EntryDraft = { ...draft, savedAt: nowIso() };
    localStorage.setItem(draftKey(userId, notebookId, entryId), JSON.stringify(payload));
  },

  clearDraft(userId: string, notebookId: string, entryId: string): void {
    localStorage.removeItem(draftKey(userId, notebookId, entryId));
  },

  shouldPreferLocalDraft(draft: EntryDraft, server: Entry): boolean {
    const draftText = stripHtml(draft.content);
    const serverText = stripHtml(server.content);
    if (!draftText && serverText) return false;
    if (draft.savedAt > server.updatedAt) return true;
    if (draftText.length > serverText.length + 20) return true;
    if ((draft.title && !server.title) || (draft.inspiration && !server.inspiration)) return true;
    return false;
  },

  /** Live draft persist — does NOT archive and does NOT advance Library progress. */
  saveOpenEntryDraft(
    entryId: string,
    patch: Partial<Pick<Entry, 'title' | 'content' | 'inspiration' | 'writingMinutes'>>,
  ): Entry | null {
    const store = read();
    const entry = store.entries.find((e) => e.id === entryId && !e.isArchived);
    if (!entry) return null;
    Object.assign(entry, patch, { updatedAt: nowIso() });
    const nb = store.notebooks.find((n) => n.id === entry.notebookId);
    if (nb) nb.updatedAt = nowIso();
    write(store);
    return entry;
  },

  /** Live minute credits onto the latest progress stub (Canvas stub mechanism). */
  creditLiveMinutes(notebookId: string, minutes: number): void {
    if (minutes <= 0) return;
    const store = read();
    const stub = store.progressRows
      .filter((p) => p.notebookId === notebookId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    if (stub) {
      stub.investmentMinutes = Math.max(0, stub.investmentMinutes) + minutes;
    }
    const open = store.entries.find((e) => e.notebookId === notebookId && !e.isArchived);
    if (open) open.writingMinutes = Math.max(0, open.writingMinutes) + minutes;
    write(store);
  },

  setInspiration(notebookId: string, inspiration: string): void {
    const store = read();
    const open = store.entries.find((e) => e.notebookId === notebookId && !e.isArchived);
    if (open) {
      open.inspiration = inspiration;
      open.updatedAt = nowIso();
    }
    const stub = store.progressRows
      .filter((p) => p.notebookId === notebookId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    if (stub) stub.inspiration = inspiration;
    write(store);
  },

  /**
   * Save Entry (= Canvas Save Session).
   * Archives the open entry, writes a progress ledger row (advances Library bar),
   * opens a fresh entry carrying Inspiration forward.
   */
  saveEntry(entryId: string): { archived: Entry; nextOpen: Entry } | null {
    const store = read();
    const entry = store.entries.find((e) => e.id === entryId && !e.isArchived);
    if (!entry) return null;

    const minutes = Math.max(1, Math.round(entry.writingMinutes || 0));
    // Remove provisional minutes from the stub that were credited live.
    const stub = store.progressRows
      .filter((p) => p.notebookId === entry.notebookId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    if (stub && stub.investmentMinutes >= entry.writingMinutes) {
      stub.investmentMinutes = Math.max(0, stub.investmentMinutes - entry.writingMinutes);
    }

    entry.isArchived = true;
    entry.updatedAt = nowIso();
    if (!entry.title.trim()) {
      entry.title = `Entry — ${new Date().toLocaleDateString()}`;
    }

    const progress: ProgressRow = {
      id: uid('prog'),
      userId: entry.userId,
      notebookId: entry.notebookId,
      title: entry.title,
      summary: stripHtml(entry.content).slice(0, 400),
      inspiration: entry.inspiration,
      investmentMinutes: minutes,
      entryId: entry.id,
      createdAt: nowIso(),
    };
    store.progressRows.push(progress);

    const nextOpen: Entry = {
      id: uid('entry'),
      userId: entry.userId,
      notebookId: entry.notebookId,
      title: '',
      content: '<p></p>',
      inspiration: entry.inspiration,
      isArchived: false,
      writingMinutes: 0,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    store.entries.push(nextOpen);

    const nb = store.notebooks.find((n) => n.id === entry.notebookId);
    if (nb) nb.updatedAt = nowIso();

    write(store);
    this.clearDraft(entry.userId, entry.notebookId, entry.id);
    return { archived: entry, nextOpen };
  },

  /** Close panel without finishing — draft stays open. */
  closeNotebookWithoutSaving(_entryId: string): void {
    // Content already draft-saved; open entry remains open.
  },

  reopenEntry(entryId: string): Entry | null {
    const store = read();
    const entry = store.entries.find((e) => e.id === entryId);
    if (!entry) return null;
    // Enforce one open entry per notebook.
    for (const e of store.entries) {
      if (e.notebookId === entry.notebookId && !e.isArchived && e.id !== entryId) {
        e.isArchived = true;
        e.updatedAt = nowIso();
      }
    }
    entry.isArchived = false;
    entry.updatedAt = nowIso();
    write(store);
    return entry;
  },

  listSavedItems(notebookId: string): SavedItem[] {
    return read()
      .savedItems.filter((s) => s.notebookId === notebookId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  addSavedItem(
    item: Omit<SavedItem, 'id' | 'createdAt' | 'completed'> & { completed?: boolean },
  ): SavedItem {
    const store = read();
    const row: SavedItem = {
      ...item,
      id: uid('item'),
      completed: item.completed ?? false,
      createdAt: nowIso(),
    };
    store.savedItems.push(row);
    write(store);
    return row;
  },

  updateSavedItem(
    id: string,
    patch: Partial<Pick<SavedItem, 'content' | 'completed' | 'category'>>,
  ): void {
    const store = read();
    const row = store.savedItems.find((s) => s.id === id);
    if (!row) return;
    Object.assign(row, patch);
    write(store);
  },

  deleteSavedItems(ids: string[]): void {
    const store = read();
    const set = new Set(ids);
    store.savedItems = store.savedItems.filter((s) => !set.has(s.id));
    write(store);
  },

  listCustomCategories(notebookId: string) {
    return read().customCategories.filter((c) => c.notebookId === notebookId);
  },

  addCustomCategory(userId: string, notebookId: string, name: string) {
    const store = read();
    const row = { id: uid('cat'), userId, notebookId, name: name.trim() };
    store.customCategories.push(row);
    write(store);
    return row;
  },

  listEvents(userId: string): CalendarEvent[] {
    return read()
      .events.filter((e) => e.userId === userId)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  },

  upsertEvent(event: Omit<CalendarEvent, 'id' | 'createdAt'> & { id?: string }): CalendarEvent {
    const store = read();
    if (event.id) {
      const existing = store.events.find((e) => e.id === event.id);
      if (existing) {
        Object.assign(existing, event);
        write(store);
        return existing;
      }
    }
    const row: CalendarEvent = {
      id: event.id ?? uid('evt'),
      userId: event.userId,
      title: event.title,
      description: event.description,
      startTime: event.startTime,
      endTime: event.endTime,
      notebookId: event.notebookId,
      source: event.source,
      externalId: event.externalId ?? null,
      createdAt: nowIso(),
    };
    store.events.push(row);
    write(store);
    return row;
  },

  deleteEvent(id: string): void {
    const store = read();
    store.events = store.events.filter((e) => e.id !== id);
    write(store);
  },

  getIcsSettings(userId: string): IcsFeedSettings | null {
    try {
      const raw = localStorage.getItem(icsSettingsKey(userId));
      if (!raw) return null;
      return JSON.parse(raw) as IcsFeedSettings;
    } catch {
      return null;
    }
  },

  setIcsSettings(userId: string, settings: IcsFeedSettings): void {
    localStorage.setItem(icsSettingsKey(userId), JSON.stringify(settings));
  },

  replaceIcsEvents(
    userId: string,
    incoming: Array<{
      externalId: string;
      title: string;
      description?: string;
      startTime: string;
      endTime: string;
    }>,
  ): number {
    const store = read();
    store.events = store.events.filter((e) => !(e.userId === userId && e.source === 'ics'));
    const createdAt = nowIso();
    for (const row of incoming) {
      store.events.push({
        id: uid('evt'),
        userId,
        title: row.title,
        description: row.description,
        startTime: row.startTime,
        endTime: row.endTime,
        notebookId: null,
        source: 'ics',
        externalId: row.externalId,
        createdAt,
      });
    }
    write(store);
    return incoming.length;
  },

  listNotesToSelf(userId: string): NoteToSelf[] {
    return read()
      .notesToSelf.filter((n) => n.userId === userId)
      .sort((a, b) => a.deliverAt.localeCompare(b.deliverAt));
  },

  addNoteToSelf(userId: string, body: string, deliverAt: string): NoteToSelf {
    const store = read();
    const row: NoteToSelf = {
      id: uid('nts'),
      userId,
      body: body.trim(),
      deliverAt,
      delivered: false,
      createdAt: nowIso(),
    };
    store.notesToSelf.push(row);
    write(store);
    return row;
  },

  markNoteDelivered(id: string): void {
    const store = read();
    const row = store.notesToSelf.find((n) => n.id === id);
    if (!row) return;
    row.delivered = true;
    write(store);
  },

  searchAll(userId: string, query: string) {
    const q = query.trim().toLowerCase();
    if (!q) return { notebooks: [], entries: [], savedItems: [] };
    const store = read();
    const notebooks = store.notebooks.filter(
      (n) => n.userId === userId && !n.isArchived && n.title.toLowerCase().includes(q),
    );
    const notebookIds = new Set(store.notebooks.filter((n) => n.userId === userId).map((n) => n.id));
    const entries = store.entries.filter(
      (e) =>
        notebookIds.has(e.notebookId) &&
        (e.title.toLowerCase().includes(q) ||
          e.inspiration.toLowerCase().includes(q) ||
          e.content.replace(/<[^>]+>/g, ' ').toLowerCase().includes(q)),
    );
    const savedItems = store.savedItems.filter(
      (s) =>
        s.userId === userId &&
        (s.content.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q) ||
          String(s.contentData?.filename ?? '')
            .toLowerCase()
            .includes(q)),
    );
    return { notebooks, entries, savedItems };
  },
};
