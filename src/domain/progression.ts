import { getLadder } from './ladders';
import { inventoryFor, nearestLoadableKg, roundForExercise } from './plates';
import { type ParsedScheme, tryParseScheme } from './program';
import type {
  Exercise,
  ExerciseResult,
  Ladder,
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

/** Seconds a timed ladder hold adds after a session where every set reached its target. */
export const HOLD_STEP_S = 5;

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
  /** Ladder id and the step the session was done at. */
  ladder?: string;
  step?: number;
  /** Assistance bands, heaviest first (for banded ladder steps). */
  bands?: { id: string; label: string }[];
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
  if (!last || (context.intensity ?? 1) < 1) return { next: lift, change: 'none' };

  const model = context.progression ?? rules.progression ?? 'amrap';
  const bodyweight = exercise.kind === 'bodyweight';
  const ladder = model === 'ladder' && context.ladder !== undefined ? getLadder(context.ladder) : undefined;
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
  } else if (ladder) {
    success = result.sets.every((set) => set.reps >= (set.target ?? range?.reps ?? SUCCESS_REPS));
    if (success) outcome = climb(ladder, lift, result.weightKg, range, context, up);
  } else if (model === 'amrap' && context.advanceAt === undefined) {
    success = last.reps >= SUCCESS_REPS;
    // Bodyweight: reps grow first; added load only once the AMRAP reaches the double-jump reps.
    if (success && bodyweight && last.reps < rules.doubleAt)
      return { next: { ...lift, weightKg: workingKg, fails: 0 }, change: 'same' };
    if (success && bodyweight) outcome = { next: { ...lift, weightKg: up(1), fails: 0 }, change: 'up' };
    else if (success) {
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
  if (model === 'ladder' && fails >= rules.failsBeforeDeload + 1) {
    // A ladder deload drops the target to the bottom of the range; it never moves down a step.
    const { reps: _reps, ...rest } = lift;
    return { next: { ...rest, weightKg: workingKg, fails: 0 }, change: 'deload' };
  }
  if (fails >= rules.failsBeforeDeload + 1) {
    const weightKg = roundForExercise(toKg(cur * (1 - rules.deloadPct), unit), exercise, 'floor', inv, unit);
    const reps = model === 'double' && range?.reps != null ? { reps: range.reps } : {};
    // No added load to take off: a bodyweight lift just starts counting misses again.
    if (bodyweight && weightKg === workingKg) return { next: { ...lift, fails: 0, ...reps }, change: 'same' };
    return { next: { ...lift, weightKg, fails: 0, ...reps }, change: 'deload' };
  }
  return { next: { ...lift, weightKg: workingKg, fails }, change: 'same' };
}

/**
 * A ladder session where every set reached its target: one more rep (or `HOLD_STEP_S` more seconds) up to the
 * top of the range; at the top a lighter band, else the next step, else added load after a weighted ladder.
 */
function climb(
  ladder: Ladder,
  lift: LiftState,
  weightKg: number,
  range: ParsedScheme | null,
  context: SessionContext,
  up: (steps: number) => number,
): Outcome {
  const { reps: _reps, bandId: _bandId, ...rest } = lift;
  const last = ladder.steps.length - 1;
  const step = Math.max(0, Math.min(last, context.step ?? lift.step ?? 0));
  if (range?.reps != null && range.repsMax != null) {
    const target = Math.max(range.reps, Math.min(range.repsMax, lift.reps ?? range.reps));
    if (target < range.repsMax) {
      const reps = Math.min(range.repsMax, target + (range.timed ? HOLD_STEP_S : 1));
      return { next: { ...lift, weightKg, step, reps, fails: 0 }, change: 'reps' };
    }
  }
  const bands = context.bands ?? [];
  const band = (s: number) => (ladder.steps[s].band && bands[0] ? { bandId: bands[0].id } : {});
  if (ladder.steps[step].band) {
    const i = bands.findIndex((b) => b.id === lift.bandId);
    if (i >= 0 && i < bands.length - 1)
      return { next: { ...rest, weightKg, step, bandId: bands[i + 1].id, fails: 0 }, change: 'up' };
  }
  if (step < last)
    return { next: { ...rest, weightKg, step: step + 1, fails: 0, ...band(step + 1) }, change: 'up' };
  if (ladder.after === 'weighted')
    return { next: { ...rest, weightKg: up(1), step, fails: 0 }, change: 'up' };
  return { next: { ...lift, weightKg, step, fails: 0 }, change: 'same' };
}

/**
 * Weight for a session: the working weight, scaled and re-rounded on light/medium days. For a bodyweight
 * exercise it is the added load (0 = none).
 */
export function sessionWeightKg(
  liftKg: number,
  intensity: number,
  exercise: Exercise,
  inv: PlateInventory,
  unit: Unit,
): number {
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
  const own = inventoryFor(exercise, inv);
  const barKg = toKg(unit === 'kg' ? own.barKg : own.barLb, unit);
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
    const kg = pct === null ? barKg : Math.max(barKg, nearestLoadableKg(pct * workKg, own, unit));
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
