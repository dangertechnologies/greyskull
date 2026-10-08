import { toUnit } from './domain';
import type { Exercise, SessionLog, Unit } from './domain';

/** One value per finished session: weight for loaded lifts, last-set reps for bodyweight. */
export function seriesFor(sessions: SessionLog[], exercise: Exercise, unit: Unit): number[] {
  const values: number[] = [];
  for (const log of sessions) {
    if (log.skipped) continue;
    const result = log.results[exercise.id];
    if (!result) continue;
    values.push(exercise.kind === 'bodyweight' ? (result.sets.at(-1)?.reps ?? 0) : toUnit(result.weightKg, unit));
  }
  return values;
}
