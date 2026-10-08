import type { Exercise } from './types';

/** Up to 3 letters for the exercise badge: the catalog's `abbr`, else initials of up to 3 words, else the first 3 letters. */
export function monogramOf(exercise: Pick<Exercise, 'name' | 'abbr'>): string {
  const abbr = exercise.abbr?.trim();
  if (abbr) return abbr.slice(0, 3).toUpperCase();
  const words = exercise.name.trim().split(/\s+/).filter(Boolean);
  const letters =
    words.length > 1
      ? words
          .slice(0, 3)
          .map((w) => w[0])
          .join('')
      : (words[0] ?? '').slice(0, 3);
  return (letters || '?').toUpperCase();
}
