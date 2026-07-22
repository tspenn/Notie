/**
 * Hash-based deep-link routing for Notie.
 *
 * Routes (all prefixed with #):
 *   /dashboard
 *   /notebook/[id]/notebook
 *   /notebook/[id]/entry/[entryId]
 *   /calendar
 *   /search
 *
 * Hash routing requires zero server config and works on any static host.
 */

export type DeepLinkRoute =
  | { type: 'dashboard' }
  | { type: 'notebook'; notebookId: string }
  | { type: 'entry'; notebookId: string; entryId: string }
  | { type: 'calendar' }
  | { type: 'search' }
  | { type: 'unknown' };

/** Parse the current window hash (or a provided hash string) into a typed route. */
export function parseDeepLink(hash?: string): DeepLinkRoute {
  const raw = (hash ?? window.location.hash).replace(/^#/, '');
  if (!raw || raw === '/' || raw === '/dashboard') return { type: 'dashboard' };

  const parts = raw.replace(/^\//, '').split('/');

  if (parts[0] === 'calendar') return { type: 'calendar' };
  if (parts[0] === 'search') return { type: 'search' };

  if (parts[0] === 'notebook' && parts[1]) {
    const notebookId = decodeURIComponent(parts[1]);
    if (parts[2] === 'entry' && parts[3]) {
      return { type: 'entry', notebookId, entryId: decodeURIComponent(parts[3]) };
    }
    if (parts[2] === 'notebook' || !parts[2]) {
      return { type: 'notebook', notebookId };
    }
  }

  return { type: 'unknown' };
}

/** Navigate to an internal deep link by setting the window hash. */
export function navigateTo(path: string): void {
  window.location.hash = path.startsWith('/') ? path : `/${path}`;
}

// ── Link builders ────────────────────────────────────────────────────────────

export function dashboardLink(): string {
  return '#/dashboard';
}

export function notebookLink(notebookId: string): string {
  return `#/notebook/${encodeURIComponent(notebookId)}/notebook`;
}

export function entryLink(notebookId: string, entryId: string): string {
  return `#/notebook/${encodeURIComponent(notebookId)}/entry/${encodeURIComponent(entryId)}`;
}

export function calendarLink(): string {
  return '#/calendar';
}

export function searchLink(): string {
  return '#/search';
}
