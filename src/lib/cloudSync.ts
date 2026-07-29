import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { localDb } from '@/lib/localDb';
import { canCloudSync } from '@/lib/plan';
import type { Entry, PlanKey, ProgressRow, SavedItem } from '@/lib/types';

export type SyncResult = {
  pushed: { notebooks: number; entries: number; savedItems: number; progress: number };
  pulled: { notebooks: number; entries: number; savedItems: number; progress: number };
};

function emptyResult(): SyncResult {
  return {
    pushed: { notebooks: 0, entries: 0, savedItems: 0, progress: 0 },
    pulled: { notebooks: 0, entries: 0, savedItems: 0, progress: 0 },
  };
}

/** Move local trial rows onto the signed-in cloud user id before first sync. */
export function adoptLocalLibrary(localUserId: string, cloudUserId: string): void {
  if (!localUserId || !cloudUserId || localUserId === cloudUserId) return;
  localDb.reassignUserId(localUserId, cloudUserId);
}

/**
 * Bidirectional sync for trial + paid Sync.
 * Download (one_device): no-op — library stays on this device only.
 */
export async function syncLibrary(opts: {
  cloudUserId: string;
  plan: PlanKey;
}): Promise<SyncResult | null> {
  if (!isSupabaseConfigured || !canCloudSync(opts.plan)) return null;

  const userId = opts.cloudUserId;
  localDb.normalizeIdsForCloud(userId);
  const result = emptyResult();

  const [
    { data: remoteNotebooks },
    { data: remoteEntries },
    { data: remoteSaved },
    { data: remoteProgress },
    { data: remoteCategories },
  ] = await Promise.all([
    supabase.from('notie_notebooks').select('*').eq('user_id', userId),
    supabase.from('notie_entries').select('*').eq('user_id', userId),
    supabase.from('notie_saved_items').select('*').eq('user_id', userId),
    supabase.from('notie_progress_rows').select('*').eq('user_id', userId),
    supabase.from('notie_custom_categories').select('*').eq('user_id', userId),
  ]);

  if (remoteNotebooks?.length) {
    for (const row of remoteNotebooks) {
      localDb.upsertNotebookFromCloud({
        id: row.id as string,
        userId,
        title: row.title as string,
        colorIndex: (row.color_index as number) ?? 0,
        isArchived: Boolean(row.is_archived),
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
      });
      result.pulled.notebooks += 1;
    }
  }

  if (remoteEntries?.length) {
    for (const row of remoteEntries) {
      localDb.upsertEntryFromCloud({
        id: row.id as string,
        userId,
        notebookId: row.notebook_id as string,
        title: (row.title as string) || 'Untitled entry',
        content: (row.content as string) || '<p></p>',
        inspiration: ((row as { inspiration?: string }).inspiration as string) || '',
        isArchived: Boolean(row.is_archived),
        writingMinutes: Number((row as { writing_minutes?: number }).writing_minutes ?? 0) || 0,
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
      });
      result.pulled.entries += 1;
    }
  }

  if (remoteSaved?.length) {
    for (const row of remoteSaved) {
      localDb.upsertSavedItemFromCloud({
        id: row.id as string,
        userId,
        notebookId: row.notebook_id as string,
        entryId: (row.entry_id as string | null) ?? null,
        category: row.category as string,
        content: (row.content as string) || '',
        contentType: (row.content_type as SavedItem['contentType']) || 'text',
        contentData: (row.content_data as Record<string, unknown> | null) ?? null,
        completed: Boolean(row.completed),
        createdAt: row.created_at as string,
      });
      result.pulled.savedItems += 1;
    }
  }

  if (remoteProgress?.length) {
    for (const row of remoteProgress) {
      localDb.upsertProgressFromCloud({
        id: row.id as string,
        userId,
        notebookId: row.notebook_id as string,
        title: (row.title as string) || '',
        summary: (row.summary as string) || '',
        inspiration: (row.inspiration as string) || '',
        investmentMinutes: Number(row.investment_minutes ?? 0) || 0,
        entryId: (row.entry_id as string | null) ?? null,
        createdAt: row.created_at as string,
      });
      result.pulled.progress += 1;
    }
  }

  if (remoteCategories?.length) {
    for (const row of remoteCategories) {
      localDb.upsertCustomCategoryFromCloud({
        id: row.id as string,
        userId,
        notebookId: row.notebook_id as string,
        name: row.name as string,
      });
    }
  }

  const notebooks = localDb.listNotebooks(userId, true);
  const notebookRows = notebooks.map((n) => ({
    id: n.id,
    user_id: userId,
    title: n.title,
    inspiration: localDb.getOpenEntry(n.id)?.inspiration ?? '',
    color_index: n.colorIndex,
    is_archived: n.isArchived,
    created_at: n.createdAt,
    updated_at: n.updatedAt,
  }));

  if (notebookRows.length) {
    const { error } = await supabase.from('notie_notebooks').upsert(notebookRows, { onConflict: 'id' });
    if (!error) result.pushed.notebooks = notebookRows.length;
    else console.warn('[notie sync] notebooks', error.message);
  }

  const entries: Entry[] = [];
  for (const n of notebooks) {
    entries.push(...localDb.listEntries(n.id));
  }

  const entryRows = entries.map((e) => ({
    id: e.id,
    user_id: userId,
    notebook_id: e.notebookId,
    title: e.title,
    content: e.content,
    inspiration: e.inspiration,
    writing_minutes: e.writingMinutes,
    is_archived: e.isArchived,
    created_at: e.createdAt,
    updated_at: e.updatedAt,
  }));

  if (entryRows.length) {
    const { error } = await supabase.from('notie_entries').upsert(entryRows, { onConflict: 'id' });
    if (!error) result.pushed.entries = entryRows.length;
    else console.warn('[notie sync] entries', error.message);
  }

  const progress = localDb.listAllProgress(userId);
  const progressRows = progress.map((p: ProgressRow) => ({
    id: p.id,
    user_id: userId,
    notebook_id: p.notebookId,
    title: p.title,
    summary: p.summary,
    inspiration: p.inspiration,
    investment_minutes: p.investmentMinutes,
    entry_id: p.entryId,
    created_at: p.createdAt,
  }));

  if (progressRows.length) {
    const { error } = await supabase.from('notie_progress_rows').upsert(progressRows, {
      onConflict: 'id',
    });
    if (!error) result.pushed.progress = progressRows.length;
    else console.warn('[notie sync] progress', error.message);
  }

  const saved = localDb.listAllSavedItems(userId);
  const savedRows = saved.map((s) => ({
    id: s.id,
    user_id: userId,
    notebook_id: s.notebookId,
    entry_id: s.entryId,
    category: s.category,
    content: s.content,
    content_type: s.contentType,
    content_data: s.contentData ?? null,
    completed: s.completed,
    created_at: s.createdAt,
  }));

  if (savedRows.length) {
    const { error } = await supabase.from('notie_saved_items').upsert(savedRows, { onConflict: 'id' });
    if (!error) result.pushed.savedItems = savedRows.length;
    else console.warn('[notie sync] saved items', error.message);
  }

  const categories = localDb.listAllCustomCategories(userId);
  if (categories.length) {
    const { error } = await supabase.from('notie_custom_categories').upsert(
      categories.map((c) => ({
        id: c.id,
        user_id: userId,
        notebook_id: c.notebookId,
        name: c.name,
      })),
      { onConflict: 'id' },
    );
    if (error) console.warn('[notie sync] categories', error.message);
  }

  return result;
}
