import { nearestLoadableKg, roundForExercise } from './plates';
import { tryParseScheme } from './program';
import type { Exercise, ExerciseResult, LiftState, PlateInventory, Rules, Scheme, Unit } from './types';
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

  const inc = incrementFor(lift, rules, exercise, unit);
  const cur = toUnit(result.weightKg, unit); // the weight actually lifted
  const up = (steps: number) => roundForExercise(toKg(cur + steps * inc, unit), exercise, 'ceil', inv, unit);
  const model = rules.progression ?? 'amrap';
  const range = context.scheme ? tryParseScheme(context.scheme) : null;

  let success: boolean;
  let outcome: Outcome | null = null;
  if (model === 'amrap') {
    success = last.reps >= SUCCESS_REPS;
    if (success) {
      const doubled = last.reps >= rules.doubleAt;
      outcome = {
        next: { ...lift, weightKg: up(doubled ? 2 : 1), fails: 0 },
        change: doubled ? 'double' : 'up',
      };
    }
  } else {
    // Every set must reach its target (an AMRAP set counts from SUCCESS_REPS).
    success = result.sets.every((set) => set.reps >= (set.target ?? SUCCESS_REPS));
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
  return { next: { ...lift, weightKg: result.weightKg, fails }, change: 'same' };
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
