import type { Exercise } from './types';

/**
 * Letters for the exercise badge: the catalog's `abbr` (up to 3), else the initials of the first 2 words
 * ("Bench-press" → BP), else the first letter of a single word ("Curls" → C).
 */
export function monogramOf(exercise: Pick<Exercise, 'name' | 'abbr'>): string {
  const abbr = exercise.abbr?.trim();
  if (abbr) return abbr.slice(0, 3).toUpperCase();
  const words = exercise.name
    .trim()
    .split(/[\s-]+/)
    .filter(Boolean);
  const letters = words
    .slice(0, 2)
    .map((w) => w[0])
    .join('');
  return (letters || '?').toUpperCase();
}
