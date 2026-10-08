import type { Exercise } from './domain';
import catalog from './exercises.json';

/** Built-in exercise catalog (a fresh copy per call so state never aliases the module). */
export function builtInExercises(): Record<string, Exercise> {
  return JSON.parse(JSON.stringify(catalog)) as Record<string, Exercise>;
}
