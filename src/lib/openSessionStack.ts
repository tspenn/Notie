/**
 * Places you opened — draft or saved tab — across notebooks.
 * Live order is frozen until you reopen (then that door moves to the top).
 * Archive moves the whole live list to the dated stack; it is not deleted.
 * Side notes are your jots on a door; they do not reorder the list.
 */

export type DoorSideNote = {
  at: number;
  text: string;
};

export type SessionDoor = {
  notebookId: string;
  notebookTitle: string;
  /** null = open draft for that notebook */
  entryId: string | null;
  entryLabel: string;
  lastAt: number;
  openedAt: number;
  archived: boolean;
  archivedAt: number | null;
  sideNotes: DoorSideNote[];
};

type DoorStore = {
  live: SessionDoor[];
  archived: SessionDoor[];
};

const MAX_LIVE = 80;
const MAX_ARCHIVED = 500;
const MAX_SIDE_NOTES = 30;

function storageKey(userId: string) {
  return `notie:session-doors:${userId}`;
}

export function doorKey(door: Pick<SessionDoor, 'notebookId' | 'entryId'>): string {
  return `${door.notebookId}::${door.entryId || 'live'}`;
}

function emptyStore(): DoorStore {
  return { live: [], archived: [] };
}

function normalizeSideNotes(raw: unknown): DoorSideNote[] {
  if (!Array.isArray(raw)) return [];
  const notes: DoorSideNote[] = [];
  for (const item of raw) {
    const text = String((item as { text?: unknown })?.text || '').trim();
    if (!text) continue;
    notes.push({
      at: Number((item as { at?: unknown })?.at) || Date.now(),
      text: text.slice(0, 500),
    });
    if (notes.length >= MAX_SIDE_NOTES) break;
  }
  return notes;
}

function normalizeDoor(raw: unknown): SessionDoor | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const notebookId = String(r.notebookId || '').trim();
  if (!notebookId) return null;
  const lastAt = Number(r.lastAt) || Date.now();
  return {
    notebookId,
    notebookTitle: String(r.notebookTitle || '').trim(),
    entryId: r.entryId ? String(r.entryId) : null,
    entryLabel: String(r.entryLabel || ''),
    lastAt,
    openedAt: Number(r.openedAt) || lastAt,
    archived: r.archived === true,
    archivedAt: r.archivedAt ? Number(r.archivedAt) : null,
    sideNotes: normalizeSideNotes(r.sideNotes),
  };
}

export function loadDoorStore(userId: string): DoorStore {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const doors = parsed.map(normalizeDoor).filter(Boolean) as SessionDoor[];
      return {
        live: doors.filter((d) => !d.archived).slice(0, MAX_LIVE),
        archived: doors.filter((d) => d.archived).slice(0, MAX_ARCHIVED),
      };
    }
    const live = Array.isArray(parsed?.live)
      ? (parsed.live.map(normalizeDoor).filter(Boolean) as SessionDoor[])
      : [];
    const archived = Array.isArray(parsed?.archived)
      ? (parsed.archived.map(normalizeDoor).filter(Boolean) as SessionDoor[])
      : [];
    return {
      live: live.filter((d) => !d.archived).slice(0, MAX_LIVE),
      archived: archived.map((d) => ({ ...d, archived: true })).slice(0, MAX_ARCHIVED),
    };
  } catch {
    return emptyStore();
  }
}

function saveDoorStore(userId: string, store: DoorStore) {
  try {
    localStorage.setItem(
      storageKey(userId),
      JSON.stringify({
        live: store.live.slice(0, MAX_LIVE),
        archived: store.archived.slice(0, MAX_ARCHIVED),
      }),
    );
  } catch {
    // ignore quota
  }
}

export function loadSessionDoors(userId: string): SessionDoor[] {
  const store = loadDoorStore(userId);
  return [...store.live, ...store.archived];
}

/** Reopen or first open: that door moves to the top of live. Nothing else moves. */
export function touchSessionDoor(
  userId: string,
  door: {
    notebookId: string;
    notebookTitle?: string;
    entryId?: string | null;
    entryLabel?: string;
  },
): SessionDoor[] {
  const notebookId = String(door.notebookId || '').trim();
  if (!userId || !notebookId) return loadSessionDoors(userId);
  const store = loadDoorStore(userId);
  const incomingKey = doorKey({ notebookId, entryId: door.entryId || null });
  const fromLive = store.live.find((d) => doorKey(d) === incomingKey);
  const fromArchived = store.archived.find((d) => doorKey(d) === incomingKey);
  const prev = fromLive || fromArchived;
  const now = Date.now();
  const next: SessionDoor = {
    notebookId,
    notebookTitle: String(door.notebookTitle || '').trim() || prev?.notebookTitle || '',
    entryId: door.entryId ? String(door.entryId) : null,
    entryLabel: String(door.entryLabel || '').trim() || prev?.entryLabel || '',
    lastAt: now,
    openedAt: prev?.openedAt || now,
    archived: false,
    archivedAt: null,
    sideNotes: prev?.sideNotes || [],
  };
  store.live = [next, ...store.live.filter((d) => doorKey(d) !== incomingKey)];
  store.archived = store.archived.filter((d) => doorKey(d) !== incomingKey);
  saveDoorStore(userId, store);
  return loadSessionDoors(userId);
}

/** Archive the entire live list as one dated batch. Nothing is deleted. */
export function archiveAllLiveDoors(userId: string): SessionDoor[] {
  const store = loadDoorStore(userId);
  if (store.live.length === 0) return loadSessionDoors(userId);
  const now = Date.now();
  const moved = store.live.map((d) => ({
    ...d,
    archived: true,
    archivedAt: now,
  }));
  store.archived = [...moved, ...store.archived];
  store.live = [];
  saveDoorStore(userId, store);
  return loadSessionDoors(userId);
}

/** Add a jot on a door. Does not reorder Live. */
export function addDoorSideNote(
  userId: string,
  door: Pick<SessionDoor, 'notebookId' | 'entryId'>,
  text: string,
): SessionDoor[] {
  const note = String(text || '').trim().slice(0, 500);
  if (!userId || !note) return loadSessionDoors(userId);
  const store = loadDoorStore(userId);
  const key = doorKey(door);
  const stamp: DoorSideNote = { at: Date.now(), text: note };
  const apply = (d: SessionDoor): SessionDoor =>
    doorKey(d) === key
      ? { ...d, sideNotes: [stamp, ...d.sideNotes].slice(0, MAX_SIDE_NOTES) }
      : d;
  store.live = store.live.map(apply);
  store.archived = store.archived.map(apply);
  saveDoorStore(userId, store);
  return loadSessionDoors(userId);
}

export function dayKeyFromMs(ms: number): string {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return 'unknown';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function dayLabelFromKey(dayKey: string, now = new Date()): string {
  if (dayKey === 'unknown') return 'Unknown date';
  const [y, m, d] = dayKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.getTime() === today.getTime()) return 'Today';
  if (date.getTime() === yesterday.getTime()) return 'Yesterday';
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  });
}
