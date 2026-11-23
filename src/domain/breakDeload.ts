import { getLadder } from './ladders';
import { roundForExercise } from './plates';
import { exerciseOfLift } from './program';
import type {
  Exercise,
  LiftState,
  PlateInventory,
  ProgressionModel,
  Scheme,
  SessionLog,
  Unit,
} from './types';

const DAY_MS = 86_400_000;

/**
 * When a lift was last trained (ISO date), in any program: the newest session that was not skipped with a result
 * for it where at least one set has reps. Light days count. A ladder id matches results logged under that lift
 * key; any other key matches its exercise, so a lift and its tiers (`BENCH_PRESS@T2`) share recency.
 */
export function lastTrained(sessions: SessionLog[], key: string): string | null {
  const ladder = getLadder(key) !== undefined;
  const id = exerciseOfLift(key);
  let newest: string | null = null;
  for (const log of sessions) {
    if (log.skipped) continue;
    const trained = Object.entries(log.results).some(
      ([exercise, r]) => (ladder ? r.lift === key : exercise === id) && r.sets.some((s) => s.reps > 0),
    );
    const at = log.finishedAt ?? log.startedAt;
    if (trained && (newest === null || Date.parse(at) > Date.parse(newest))) newest = at;
  }
  return newest;
}

/** Whole days between `last` (ISO) and `now` (epoch ms). */
export const gapDays = (last: string, now: number): number => Math.floor((now - Date.parse(last)) / DAY_MS);

export interface EaseContext {
  exercise: Exercise;
  inv: PlateInventory;
  unit: Unit;
  scheme: Scheme;
  progression?: ProgressionModel;
  ladder?: string;
  /** Assistance bands, heaviest first. */
  bands?: { id: string; label: string }[];
}

/**
 * The lift eased back after `gap` days without training it, or null when nothing changes. From 14 days the
 * weight (added load, 5/3/1 training max) drops 10 %, from 28 days 20 %, from 56 days 30 %, rounded down to a
 * loadable weight. A rep target drops to the bottom of its range; from 28 days a ladder also goes down one step
 * (a weighted ladder past its last step eases its added load instead). Misses reset; the GZCLP stage stays.
 */
export function easeBack(lift: LiftState, gap: number, ctx: EaseContext): LiftState | null {
  if (gap < 14) return null;
  const pct = gap >= 56 ? 0.3 : gap >= 28 ? 0.2 : 0.1;
  const { reps: _reps, ...next } = lift;
  next.fails = 0;
  if (lift.weightKg > 0)
    next.weightKg = roundForExercise(lift.weightKg * (1 - pct), ctx.exercise, 'floor', ctx.inv, ctx.unit);
  const ladder = ctx.progression === 'ladder' && ctx.ladder ? getLadder(ctx.ladder) : undefined;
  if (ladder && gap >= 28 && lift.weightKg <= 0 && (lift.step ?? 0) > 0) {
    next.step = (lift.step ?? 0) - 1;
    delete next.bandId;
    const heaviest = ctx.bands?.[0];
    if (ladder.steps[next.step]?.band && heaviest) next.bandId = heaviest.id;
  }
  return JSON.stringify(next) === JSON.stringify(lift) ? null : next;
}
