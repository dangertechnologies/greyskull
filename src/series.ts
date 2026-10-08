import type { Exercise, SessionLog, Unit } from './domain';
import { toUnit } from './domain';

export interface SeriesPoint {
  n: number;
  /** ISO timestamp of the session. */
  date: string;
  /** Weight in the display unit for loaded lifts; last-set reps for bodyweight lifts. */
  value: number;
  reps: number;
  /** True when this is a new best (strictly above every earlier point). */
  pr: boolean;
}

/**
 * One point per finished session. Skipped sessions and light/medium days (which are deliberately lighter)
 * are left out so the line shows the working weight.
 */
export function seriesPoints(sessions: SessionLog[], exercise: Exercise, unit: Unit): SeriesPoint[] {
  const points: SeriesPoint[] = [];
  let best = Number.NEGATIVE_INFINITY;
  for (const log of sessions) {
    if (log.skipped || (log.intensity ?? 1) < 1) continue;
    const result = log.results[exercise.id];
    if (!result) continue;
    const reps = result.sets.at(-1)?.reps ?? 0;
    const value = exercise.kind === 'bodyweight' ? reps : toUnit(result.weightKg, unit);
    points.push({ n: log.n, date: log.finishedAt ?? log.startedAt, value, reps, pr: value > best });
    best = Math.max(best, value);
  }
  return points;
}

/** One value per finished session (see `seriesPoints`). */
export function seriesFor(sessions: SessionLog[], exercise: Exercise, unit: Unit): number[] {
  return seriesPoints(sessions, exercise, unit).map((p) => p.value);
}

export type ChartRange = '3M' | '6M' | '1Y' | 'All';

const RANGE_DAYS: Record<Exclude<ChartRange, 'All'>, number> = { '3M': 91, '6M': 182, '1Y': 365 };

/** Points inside the range ending at `now`; the full series for 'All'. */
export function inRange<T extends { date: string }>(points: T[], range: ChartRange, now: Date): T[] {
  if (range === 'All') return points;
  const from = now.getTime() - RANGE_DAYS[range] * 86_400_000;
  return points.filter((p) => new Date(p.date).getTime() >= from);
}
