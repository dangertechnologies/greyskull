import { getLadder, stepIn, stepTransition } from './ladders';
import { roundForExercise } from './plates';
import { exerciseOfLift, sessionFor } from './program';
import type {
  ActiveProgram,
  AppState,
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
    // An unreadable date tells nothing about when the lift was trained.
    if (!trained || Number.isNaN(Date.parse(at))) continue;
    if (newest === null || Date.parse(at) > Date.parse(newest)) newest = at;
  }
  return newest;
}

/**
 * Whole days between `last` (ISO) and `now` (epoch ms). These are elapsed 24-hour periods, not calendar days, so
 * the time of day and a daylight-saving change can shift a boundary by one day.
 */
export const gapDays = (last: string, now: number): number => Math.floor((now - Date.parse(last)) / DAY_MS);

/**
 * True when the lift state was set after `last` (a new program, a retest, a manual edit, or a session already
 * eased): it reflects the user now and is not eased again. An unreadable `touchedAt` counts as set, so the app
 * never cuts a weight it cannot prove is stale.
 */
export const touchedSince = (lift: LiftState, last: string): boolean =>
  lift.touchedAt !== undefined && !(Date.parse(lift.touchedAt) <= Date.parse(last));

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
  if (!(gap >= 14)) return null;
  const pct = gap >= 56 ? 0.3 : gap >= 28 ? 0.2 : 0.1;
  const { reps: _reps, ...next } = lift;
  next.fails = 0;
  if (lift.weightKg > 0)
    next.weightKg = roundForExercise(lift.weightKg * (1 - pct), ctx.exercise, 'floor', ctx.inv, ctx.unit);
  const ladder = ctx.progression === 'ladder' && ctx.ladder ? getLadder(ctx.ladder) : undefined;
  const step = ladder ? stepIn(ladder, lift.step) : 0;
  if (ladder && gap >= 28 && lift.weightKg <= 0 && step > 0)
    return stepTransition(next, step - 1, ladder, ctx.bands ?? []);
  // Resetting misses alone is no ease: nothing the user would lift or see changes.
  return JSON.stringify({ ...next, fails: lift.fails }) === JSON.stringify(lift) ? null : next;
}

/**
 * The lift states the next workout of `program` starts from after a break (only the lifts that change), and the
 * longest gap eased. Empty when `breakDeload` is off. The one place `startSession` and every preview of the
 * next workout decide this, so a preview never shows a weight the workout will not use.
 */
export function easedLifts(
  s: Pick<AppState, 'breakDeload' | 'exercises' | 'inventory' | 'unit' | 'bands' | 'sessions'>,
  program: ActiveProgram,
  now: number,
): { lifts: Record<string, LiftState>; gap: number } {
  const lifts: Record<string, LiftState> = {};
  let gap = 0;
  if (!s.breakDeload) return { lifts, gap };
  for (const slot of sessionFor(program).slots) {
    const lift = program.lifts[slot.lift];
    const exercise = s.exercises[slot.exercise];
    const last = lastTrained(s.sessions, slot.lift);
    // A state set since the last training (a new program, a retest, an earlier eased session) is current.
    if (!lift || !exercise || !last || lifts[slot.lift] || touchedSince(lift, last)) continue;
    const days = gapDays(last, now);
    const next = easeBack(lift, days, { ...slot, exercise, inv: s.inventory, unit: s.unit, bands: s.bands });
    if (!next) continue;
    lifts[slot.lift] = next;
    gap = Math.max(gap, days);
  }
  return { lifts, gap };
}
