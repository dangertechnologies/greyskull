import type { Exercise } from './domain';
import catalog from './exercises.json';

/**
 * Bump when the built-in content in `exercises.json` changes (form tips, videos, links, photos). Installs with
 * an older version get the new content on next launch (see `refreshCatalog`).
 */
export const CATALOG_VERSION = 3;

/** Fields of a built-in exercise that ship with the app and are refreshed on catalog updates. */
const CONTENT_FIELDS = ['description', 'goodForm', 'badForm', 'video', 'url', 'background', 'abbr'] as const;

/** Built-in exercise catalog (a fresh copy per call so state never aliases the module). */
export function builtInExercises(): Record<string, Exercise> {
  return JSON.parse(JSON.stringify(catalog)) as Record<string, Exercise>;
}

/**
 * Brings stored built-in exercises up to date with the shipped catalog: content fields are replaced, while
 * the user's own settings (name, short name, kind, increments, step) are kept. Missing built-ins are added and
 * custom exercises are untouched.
 */
export function refreshCatalog(stored: Record<string, Exercise>): Record<string, Exercise> {
  const next: Record<string, Exercise> = { ...stored };
  for (const [id, shipped] of Object.entries(builtInExercises())) {
    const current = stored[id];
    if (!current) {
      next[id] = shipped;
      continue;
    }
    const updated: Exercise = { ...current };
    for (const field of CONTENT_FIELDS) {
      if (shipped[field] === undefined) delete updated[field];
      else Object.assign(updated, { [field]: shipped[field] });
    }
    next[id] = updated;
  }
  return next;
}
