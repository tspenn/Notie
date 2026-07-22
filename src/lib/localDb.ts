import {
  type CalendarEvent,
  type Entry,
  type IcsFeedSettings,
  type NotebookMeta,
  type NoteToSelf,
  type NotieStore,
  type PlanKey,
  type SavedItem,
  type UserProfile,
} from './types';
import { uid } from './utils';

const STORAGE_KEY = 'notie_local_db_v1';

function icsSettingsKey(userId: string): string {
  return `notie_ics_feed:${userId}`;
}

function emptyStore(): NotieStore {
  return {
    version: 1,
    profile: null,
    notebooks: [],
    entries: [],
    savedItems: [],
    events: [],
    notesToSelf: [],
    customCategories: [],
  };
}

function read(): NotieStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as NotieStore;
    if (parsed?.version !== 1) return emptyStore();
    return parsed;
  } catch {
    return emptyStore();
  }
}

function write(store: NotieStore): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function nowIso(): string {
  return new Date().toISOString();
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
    // Keep data; clear only the "session" flag used by AuthContext.
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

  createNotebook(userId: string, title: string): NotebookMeta {
    const store = read();
    const notebook: NotebookMeta = {
      id: uid('nb'),
      userId,
      title: title.trim() || 'Untitled notebook',
      inspiration: '',
      colorIndex: store.notebooks.length % 8,
      isArchived: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    store.notebooks.push(notebook);
    const entry: Entry = {
      id: uid('entry'),
      userId,
      notebookId: notebook.id,
      title: 'First entry',
      content: '<p></p>',
      isArchived: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    store.entries.push(entry);
    write(store);
    return notebook;
  },

  updateNotebook(
    notebookId: string,
    patch: Partial<Pick<NotebookMeta, 'title' | 'inspiration' | 'isArchived' | 'colorIndex'>>,
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
    store.savedItems = store.savedItems.filter((s) => s.notebookId !== notebookId);
    store.customCategories = store.customCategories.filter((c) => c.notebookId !== notebookId);
    write(store);
  },

  getOpenEntry(notebookId: string): Entry | null {
    const open = read().entries
      .filter((e) => e.notebookId === notebookId && !e.isArchived)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return open[0] ?? null;
  },

  getPreviousEntry(notebookId: string, excludeId?: string): Entry | null {
    const archived = read().entries
      .filter(
        (e) =>
          e.notebookId === notebookId &&
          e.isArchived &&
          (!excludeId || e.id !== excludeId),
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return archived[0] ?? null;
  },

  listEntries(notebookId: string): Entry[] {
    return read()
      .entries.filter((e) => e.notebookId === notebookId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  ensureOpenEntry(userId: string, notebookId: string): Entry {
    const existing = this.getOpenEntry(notebookId);
    if (existing) return existing;
    const store = read();
    const previous = this.getPreviousEntry(notebookId);
    const entry: Entry = {
      id: uid('entry'),
      userId,
      notebookId,
      title: previous ? `Continued from ${previous.title}` : 'New entry',
      content: '<p></p>',
      isArchived: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    store.entries.push(entry);
    write(store);
    return entry;
  },

  saveEntry(entryId: string, patch: Partial<Pick<Entry, 'title' | 'content'>>): Entry | null {
    const store = read();
    const entry = store.entries.find((e) => e.id === entryId);
    if (!entry) return null;
    Object.assign(entry, patch, { updatedAt: nowIso() });
    const nb = store.notebooks.find((n) => n.id === entry.notebookId);
    if (nb) nb.updatedAt = nowIso();
    write(store);
    return entry;
  },

  closeEntry(entryId: string): Entry | null {
    const store = read();
    const entry = store.entries.find((e) => e.id === entryId);
    if (!entry) return null;
    entry.isArchived = true;
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

  clearIcsSettings(userId: string): void {
    localStorage.removeItem(icsSettingsKey(userId));
  },

  /** Replace all ICS-imported events for a user with a fresh sync set. */
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
      (n) =>
        n.userId === userId &&
        !n.isArchived &&
        (n.title.toLowerCase().includes(q) || n.inspiration.toLowerCase().includes(q)),
    );
    const notebookIds = new Set(store.notebooks.filter((n) => n.userId === userId).map((n) => n.id));
    const entries = store.entries.filter(
      (e) =>
        notebookIds.has(e.notebookId) &&
        (e.title.toLowerCase().includes(q) ||
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
