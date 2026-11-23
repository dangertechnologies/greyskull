import type { Exercise, ExerciseResult, SessionLog, Unit } from './domain';
import { exerciseOfLift, toUnit, tryParseScheme } from './domain';
import { getLadder } from './domain/ladders';

/** Exercise id and result for a lift key (see `resultFor`). */
function entryFor(log: SessionLog, key: string): [string, ExerciseResult] | undefined {
  const id = exerciseOfLift(key);
  const result = log.results[id];
  if (result && (result.lift ?? id) === key) return [id, result];
  return Object.entries(log.results).find(([, r]) => r.lift === key);
}

/**
 * A session's result for a lift key; GZCLP T1 and T2 of one exercise are told apart by `result.lift`, and a
 * ladder's result (keyed by its step's exercise) is found by its ladder id in `result.lift`.
 */
export function resultFor(log: SessionLog, key: string): ExerciseResult | undefined {
  return entryFor(log, key)?.[1];
}

const amount = (n: number, timed: boolean): string => (timed ? `${n} s` : `${n} ${n === 1 ? 'rep' : 'reps'}`);

/** Ladder level: the step, plus how far up the step's range the best set got (0 to 1). */
function ladderLevel(result: ExerciseResult, best: number): number {
  const step = result.step ?? 0;
  const scheme = result.scheme ? tryParseScheme(result.scheme) : null;
  if (scheme?.reps == null) return step;
  const fraction =
    scheme.repsMax === null || scheme.repsMax === scheme.reps
      ? best >= scheme.reps
        ? 1
        : 0
      : (best - scheme.reps) / (scheme.repsMax - scheme.reps);
  return step + Math.max(0, Math.min(1, fraction));
}

/**
 * True when a bodyweight lift (not a ladder) carried added load in any finished session: its chart shows the load
 * rather than reps, so one axis never mixes reps and kilograms.
 */
export function chartsAddedLoad(sessions: SessionLog[], exercise: Exercise, key = exercise.id): boolean {
  if (exercise.kind !== 'bodyweight' || getLadder(key)) return false;
  return sessions.some((log) => !log.skipped && (entryFor(log, key)?.[1].weightKg ?? 0) > 0);
}

export interface SeriesPoint {
  n: number;
  /** ISO timestamp of the session. */
  date: string;
  /**
   * Weight in the display unit for loaded lifts (the training max for 5/3/1) and for bodyweight lifts that have
   * carried added load (`chartsAddedLoad`); last-set reps (or seconds) for other bodyweight lifts; for a ladder, the step plus progress through the step's range.
   */
  value: number;
  reps: number;
  /** Ladders: the step's exercise and best set ("Arch hang · 20 s"); timed results: seconds ("45 s"). */
  label?: string;
  /** True when this is a new best (strictly above every earlier point). */
  pr: boolean;
}

/**
 * One point per finished session. Skipped sessions and light/medium days (which are deliberately lighter)
 * are left out so the line shows the working weight.
 */
export function seriesPoints(
  sessions: SessionLog[],
  exercise: Exercise,
  unit: Unit,
  key = exercise.id,
  /** Exercise names for ladder labels. */
  exercises?: Record<string, Exercise>,
): SeriesPoint[] {
  const ladder = getLadder(key) !== undefined;
  const reps = exercise.kind === 'bodyweight' && !chartsAddedLoad(sessions, exercise, key);
  const points: SeriesPoint[] = [];
  let best = Number.NEGATIVE_INFINITY;
  for (const log of sessions) {
    if (log.skipped || (log.intensity ?? 1) < 1) continue;
    const entry = entryFor(log, key);
    if (!entry) continue;
    const [id, result] = entry;
    const last = result.sets.at(-1)?.reps ?? 0;
    const timed = result.timed === true || (result.scheme ? !!tryParseScheme(result.scheme)?.timed : false);
    const top = Math.max(0, ...result.sets.map((s) => s.reps));
    const value = ladder
      ? ladderLevel(result, top)
      : reps
        ? last
        : toUnit(result.tmKg ?? result.weightKg, unit);
    const label = ladder
      ? `${exercises?.[id]?.name ?? id} · ${amount(top, timed)}`
      : timed
        ? amount(last, true)
        : undefined;
    points.push({
      n: log.n,
      date: log.finishedAt ?? log.startedAt,
      value,
      reps: last,
      pr: value > best,
      ...(label ? { label } : {}),
    });
    best = Math.max(best, value);
  }
  return points;
}

/** One value per finished session (see `seriesPoints`). */
export function seriesFor(
  sessions: SessionLog[],
  exercise: Exercise,
  unit: Unit,
  key = exercise.id,
): number[] {
  return seriesPoints(sessions, exercise, unit, key).map((p) => p.value);
}

export type ChartRange = '3M' | '6M' | '1Y' | 'All';

const RANGE_DAYS: Record<Exclude<ChartRange, 'All'>, number> = { '3M': 91, '6M': 182, '1Y': 365 };

/** Points inside the range ending at `now`; the full series for 'All'. */
export function inRange<T extends { date: string }>(points: T[], range: ChartRange, now: Date): T[] {
  if (range === 'All') return points;
  const from = now.getTime() - RANGE_DAYS[range] * 86_400_000;
  return points.filter((p) => new Date(p.date).getTime() >= from);
}
