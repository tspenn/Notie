export type PlanKey = 'one_device' | 'cloud_sync';

export type CategoryKey =
  | 'Files'
  | 'Gallery'
  | 'Plans'
  | 'Lists'
  | 'To Do'
  | string;

export type SavedContentType = 'text' | 'url' | 'image' | 'file';

/** A notebook on the Library shelf (= Canvas project). */
export interface NotebookMeta {
  id: string;
  userId: string;
  title: string;
  colorIndex: number;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * An Entry (= WorkZone session).
 * Open entry (!isArchived): live writing space; draft autosaves here.
 * Archived: finished Entry in history — only after Save Entry.
 */
export interface Entry {
  id: string;
  userId: string;
  notebookId: string;
  title: string;
  content: string;
  /** Inspiration / beacon note for this entry. */
  inspiration: string;
  isArchived: boolean;
  /** Minutes accrued while this entry was open (finalized into a ProgressRow on Save Entry). */
  writingMinutes: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Library progress ledger row (= corporate_canvas_mockup session).
 * Created only when the user Saves an Entry — this is what fills the book bar.
 */
export interface ProgressRow {
  id: string;
  userId: string;
  notebookId: string;
  title: string;
  summary: string;
  inspiration: string;
  investmentMinutes: number;
  entryId: string | null;
  createdAt: string;
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
  version: 2;
  profile: UserProfile | null;
  notebooks: NotebookMeta[];
  entries: Entry[];
  progressRows: ProgressRow[];
  savedItems: SavedItem[];
  events: CalendarEvent[];
  notesToSelf: NoteToSelf[];
  customCategories: { id: string; userId: string; name: string; notebookId: string }[];
}

export interface NotebookShelfData {
  notebook: NotebookMeta;
  totalMinutes: number;
  todayMinutes: number;
  barHeight: number;
  previousEntry: Entry | null;
  inspiration: string;
  openEntryId: string | null;
  color: (typeof BOOK_COLORS)[number];
}

export const BOOK_COLORS = [
  { spine: '#3d6b63', cover: '#6f968e', gradient: 'from-[#3d6b63] to-[#6f968e]', hex: '#3d6b63', label: 'moss' },
  { spine: '#4a6741', cover: '#8fa882', gradient: 'from-[#4a6741] to-[#8fa882]', hex: '#4a6741', label: 'leaf' },
  { spine: '#5c6b73', cover: '#9aadb6', gradient: 'from-[#5c6b73] to-[#9aadb6]', hex: '#5c6b73', label: 'slate' },
  { spine: '#6b5344', cover: '#b08d75', gradient: 'from-[#6b5344] to-[#b08d75]', hex: '#6b5344', label: 'bark' },
  { spine: '#3f5e6b', cover: '#7a9eab', gradient: 'from-[#3f5e6b] to-[#7a9eab]', hex: '#3f5e6b', label: 'tide' },
  { spine: '#5a6b3d', cover: '#a3b57a', gradient: 'from-[#5a6b3d] to-[#a3b57a]', hex: '#5a6b3d', label: 'olive' },
  { spine: '#6b4f3f', cover: '#c4a484', gradient: 'from-[#6b4f3f] to-[#c4a484]', hex: '#6b4f3f', label: 'kraft' },
  { spine: '#456b5c', cover: '#8fb5a3', gradient: 'from-[#456b5c] to-[#8fb5a3]', hex: '#456b5c', label: 'seafoam' },
] as const;

export const DEFAULT_CATEGORIES: CategoryKey[] = [
  'Files',
  'Gallery',
  'Plans',
  'Lists',
  'To Do',
];

export const CHECKABLE_CATEGORIES = new Set(['Lists', 'To Do']);

export function getBarHeight(totalMinutes: number): number {
  // Canvas CorporateCanvas curve: fast early growth, compresses at the top.
  const base = 48;
  const max = 160;
  return Math.min(max, Math.round(base + Math.sqrt(Math.max(0, totalMinutes)) * 7));
}

export function formatBarMinutes(mins: number): string {
  if (mins < 60) return `${Math.round(mins)}m`;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function pickBookColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return BOOK_COLORS[Math.abs(hash) % BOOK_COLORS.length];
}
