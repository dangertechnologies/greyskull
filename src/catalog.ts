import catalog from './catalog/exercises.json';
import type { Exercise } from './domain';

/**
 * Bump when the built-in content in `catalog/exercises.json` changes (descriptions, form tips, videos, muscles,
 * pictograms, new entries). Installs with an older version get the new content on next launch (see
 * `refreshCatalog`).
 */
export const CATALOG_VERSION = 5;

/**
 * Fields of a built-in exercise that ship with the app and are refreshed on catalog updates. The fields a user
 * may change are listed in `USER_FIELDS` (src/domain/exerciseFields.ts) and are restored on top afterwards.
 */
const CONTENT_FIELDS = [
  'description',
  'goodForm',
  'badForm',
  'video',
  'url',
  'background',
  'abbr',
  'equipment',
  'muscles',
  'secondary',
  'pattern',
  'level',
  'timed',
  'pictogram',
] as const;

/** Built-in exercise catalog (a fresh copy per call so state never aliases the module). */
export function builtInExercises(): Record<string, Exercise> {
  return JSON.parse(JSON.stringify(catalog)) as Record<string, Exercise>;
}

/**
 * Brings stored built-in exercises up to date with the shipped catalog: content fields are replaced, while
 * the user's own settings (name, short name, kind, increments, step) are kept. Missing built-ins are added and
 * custom exercises are untouched. A bodyweight built-in stored with a zero increment (from when bodyweight
 * lifts could not carry added load) gets the shipped increment.
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
    if (updated.kind === 'bodyweight' && updated.increment.kg === 0 && updated.increment.lb === 0) {
      updated.increment = shipped.increment;
    }
    next[id] = updated;
  }
  return next;
}
