import { nearestLoadableKg, roundForExercise } from './plates';
import { tryParseScheme } from './program';
import type {
  Exercise,
  ExerciseResult,
  LiftState,
  PlateInventory,
  ProgressionModel,
  Rules,
  Scheme,
  SetResult,
  Unit,
} from './types';
import { toKg, toUnit } from './units';

export interface Outcome {
  next: LiftState;
  /** `reps`: double progression added a rep to the target instead of weight. */
  change: 'up' | 'double' | 'reps' | 'same' | 'deload' | 'none';
}

/** Minimum AMRAP reps that count as a successful session. */
export const SUCCESS_REPS = 5;

export interface SessionContext {
  /** The slot's scheme; needed for the rep range of double progression. */
  scheme?: Scheme;
  stages?: Scheme[];
  advanceAt?: number;
  progression?: ProgressionModel;
  week?: number;
  lastInWeek?: boolean;
  /** Day intensity (light/medium days below 1 never progress). */
  intensity?: number;
}

/** Increment for a lift: the user's override, then the plan's, then the exercise default. */
export function incrementFor(lift: LiftState, rules: Rules, exercise: Exercise, unit: Unit): number {
  return (lift.incrementOverride ?? rules.increments?.[exercise.id] ?? exercise.increment)[unit];
}

/**
 * Pure progression for one lift after a finished session. Applied exactly once, by the store's
 * `finishSession`; never from timers or animation callbacks.
 */
export function nextLift(
  lift: LiftState,
  result: ExerciseResult,
  rules: Rules,
  exercise: Exercise,
  inv: PlateInventory,
  unit: Unit,
  context: SessionContext = {},
): Outcome {
  const last = result.sets[result.sets.length - 1];
  if (exercise.kind === 'bodyweight' || !last || (context.intensity ?? 1) < 1)
    return { next: lift, change: 'none' };

  const model = context.progression ?? rules.progression ?? 'amrap';
  if (model === '531' && (context.week !== 2 || !context.lastInWeek)) return { next: lift, change: 'none' };

  const inc = incrementFor(lift, rules, exercise, unit);
  const workingKg = model === '531' ? lift.weightKg : result.weightKg;
  const cur = toUnit(workingKg, unit); // the weight actually lifted
  const up = (steps: number) => roundForExercise(toKg(cur + steps * inc, unit), exercise, 'ceil', inv, unit);
  const range = context.scheme ? tryParseScheme(context.scheme) : null;

  let success: boolean;
  let outcome: Outcome | null = null;
  if (model === '531') {
    success = (result.sets[2]?.reps ?? 0) >= 1;
    if (success) outcome = { next: { ...lift, weightKg: up(1), fails: 0 }, change: 'up' };
  } else if (model === 'amrap' && context.advanceAt === undefined) {
    success = last.reps >= SUCCESS_REPS;
    if (success) {
      const doubled = last.reps >= rules.doubleAt;
      outcome = {
        next: { ...lift, weightKg: up(doubled ? 2 : 1), fails: 0 },
        change: doubled ? 'double' : 'up',
      };
    }
  } else {
    // Every set must reach its target (an AMRAP set counts from its scheme's minimum, else SUCCESS_REPS).
    const met = result.sets.every((set) => set.reps >= (set.target ?? range?.reps ?? SUCCESS_REPS));
    // Below `advanceAt` (GZCLP T3: 25) a completed session holds the weight; it is not a miss.
    if (met && context.advanceAt !== undefined && last.reps < context.advanceAt)
      return { next: { ...lift, weightKg: workingKg, fails: 0 }, change: 'same' };
    success = met;
    if (!success && model === 'stages') {
      const stage = Math.max(0, Math.min((context.stages?.length ?? 1) - 1, lift.stage ?? 0));
      if (stage < (context.stages?.length ?? 1) - 1)
        return { next: { ...lift, weightKg: workingKg, stage: stage + 1, fails: 0 }, change: 'same' };
      // ponytail: GZCLP retests a 5RM / restarts at the last stage-1 weight + 15–20 lb; use a percentage deload.
      const weightKg = roundForExercise(workingKg * (1 - rules.deloadPct), exercise, 'floor', inv, unit);
      return { next: { ...lift, weightKg, stage: 0, fails: 0 }, change: 'deload' };
    }
    if (success && model === 'double' && range?.reps != null && range.repsMax != null) {
      const target = Math.max(range.reps, Math.min(range.repsMax, lift.reps ?? range.reps));
      outcome =
        target < range.repsMax
          ? { next: { ...lift, weightKg: result.weightKg, reps: target + 1, fails: 0 }, change: 'reps' }
          : { next: { ...lift, weightKg: up(1), reps: range.reps, fails: 0 }, change: 'up' };
    } else if (success) {
      outcome = { next: { ...lift, weightKg: up(1), fails: 0 }, change: 'up' };
    }
  }
  if (outcome) return outcome;

  const fails = lift.fails + 1;
  if (fails >= rules.failsBeforeDeload + 1) {
    const weightKg = roundForExercise(toKg(cur * (1 - rules.deloadPct), unit), exercise, 'floor', inv, unit);
    const reps = model === 'double' && range?.reps != null ? { reps: range.reps } : {};
    return { next: { ...lift, weightKg, fails: 0, ...reps }, change: 'deload' };
  }
  return { next: { ...lift, weightKg: workingKg, fails }, change: 'same' };
}

/** Weight for a session: the working weight, scaled and re-rounded on light/medium days. */
export function sessionWeightKg(
  liftKg: number,
  intensity: number,
  exercise: Exercise,
  inv: PlateInventory,
  unit: Unit,
): number {
  if (exercise.kind === 'bodyweight') return 0;
  return intensity < 1 ? roundForExercise(liftKg * intensity, exercise, 'nearest', inv, unit) : liftKg;
}

export interface Warmup {
  reps: number;
  kg: number;
}

/** Warm-up sets (reps × weight) leading to a work weight. Not persisted. */
export function warmups(
  workKg: number,
  scheme: Scheme,
  exercise: Exercise,
  inv: PlateInventory,
  unit: Unit,
): Warmup[] {
  const parsed = tryParseScheme(scheme);
  if (exercise.kind !== 'barbell' || !parsed || parsed.reps === null) return [];
  const barKg = toKg(unit === 'kg' ? inv.barKg : inv.barLb, unit);
  // A single heavy set (deadlifts) gets two bigger jumps; everything else ramps up from the empty bar.
  const plan: { reps: number; pct: number | null }[] =
    parsed.sets === 1
      ? [
          { reps: 5, pct: 0.5 },
          { reps: 3, pct: 0.75 },
        ]
      : [
          { reps: 5, pct: null },
          { reps: 4, pct: 0.55 },
          { reps: 3, pct: 0.7 },
          { reps: 2, pct: 0.85 },
        ];
  const out: Warmup[] = [];
  plan.forEach(({ reps, pct }, i) => {
    const kg = pct === null ? barKg : Math.max(barKg, nearestLoadableKg(pct * workKg, inv, unit));
    // The first set is always kept (an empty-bar set even when the work weight is the bar).
    if (i > 0 && (Math.abs(kg - workKg) < 1e-9 || out.some((w) => Math.abs(w.kg - kg) < 1e-9))) return;
    out.push({ reps, kg });
  });
  return out;
}

const FIVE_THREE_ONE = [
  { percentages: [0.65, 0.75, 0.85], reps: [5, 5, 5] },
  { percentages: [0.7, 0.8, 0.9], reps: [3, 3, 3] },
  { percentages: [0.75, 0.85, 0.95], reps: [5, 3, 1] },
] as const;

export function fiveThreeOneSets(
  tmKg: number,
  week: number,
  exercise: Exercise,
  inv: PlateInventory,
  unit: Unit,
): SetResult[] {
  const { percentages, reps } = FIVE_THREE_ONE[week % 3];
  return Array.from({ length: 8 }, (_, i) => ({
    target: i === 2 ? null : i < 3 ? reps[i] : 5,
    reps: 0,
    kg: roundForExercise(tmKg * percentages[i < 3 ? i : 0], exercise, 'nearest', inv, unit),
  }));
}
