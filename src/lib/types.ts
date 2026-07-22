export type PlanKey = 'one_device' | 'cloud_sync';

export type CategoryKey =
  | 'Files'
  | 'Gallery'
  | 'Plans'
  | 'Lists'
  | 'To Do'
  | string;

export type SavedContentType = 'text' | 'url' | 'image' | 'file';

export interface NotebookMeta {
  id: string;
  userId: string;
  title: string;
  inspiration: string;
  colorIndex: number;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

/** An Entry is a writing checkpoint (renamed from FRIDAY Session). */
export interface Entry {
  id: string;
  userId: string;
  notebookId: string;
  title: string;
  content: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SavedItem {
  id: string;
  userId: string;
  notebookId: string;
  entryId: string | null;
  category: CategoryKey;
  content: string;
  contentType: SavedContentType;
  contentData?: Record<string, unknown> | null;
  completed: boolean;
  createdAt: string;
}

export interface CalendarEvent {
  id: string;
  userId: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  notebookId?: string | null;
  source: 'notie' | 'ics' | 'google' | 'outlook';
  /** ICS / external UID (for sync replace). */
  externalId?: string | null;
  createdAt: string;
}

export interface IcsFeedSettings {
  feedUrl: string;
  lastSynced: string | null;
}

export interface NoteToSelf {
  id: string;
  userId: string;
  body: string;
  deliverAt: string;
  delivered: boolean;
  createdAt: string;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  plan: PlanKey;
  welcomeCompletedAt: string | null;
  createdAt: string;
}

export interface NotieStore {
  version: 1;
  profile: UserProfile | null;
  notebooks: NotebookMeta[];
  entries: Entry[];
  savedItems: SavedItem[];
  events: CalendarEvent[];
  notesToSelf: NoteToSelf[];
  customCategories: { id: string; userId: string; name: string; notebookId: string }[];
}

export const BOOK_COLORS = [
  { spine: '#3d6b63', cover: '#6f968e', label: 'moss' },
  { spine: '#4a6741', cover: '#8fa882', label: 'leaf' },
  { spine: '#5c6b73', cover: '#9aadb6', label: 'slate' },
  { spine: '#6b5344', cover: '#b08d75', label: 'bark' },
  { spine: '#3f5e6b', cover: '#7a9eab', label: 'tide' },
  { spine: '#5a6b3d', cover: '#a3b57a', label: 'olive' },
  { spine: '#6b4f3f', cover: '#c4a484', label: 'kraft' },
  { spine: '#456b5c', cover: '#8fb5a3', label: 'seafoam' },
] as const;

export const DEFAULT_CATEGORIES: CategoryKey[] = [
  'Files',
  'Gallery',
  'Plans',
  'Lists',
  'To Do',
];

export const CHECKABLE_CATEGORIES = new Set(['Lists', 'To Do']);
