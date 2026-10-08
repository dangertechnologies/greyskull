import type { Exercise, ExerciseResult, LiftState, PlateInventory, Rules, Scheme, Unit } from './types';
import { nearestLoadableKg, roundForExercise } from './plates';
import { toKg, toUnit } from './units';

export interface Outcome {
  next: LiftState;
  change: 'up' | 'double' | 'same' | 'deload' | 'none';
}

/** Minimum AMRAP reps that count as a successful session. */
export const SUCCESS_REPS = 5;

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
): Outcome {
  const last = result.sets[result.sets.length - 1];
  if (exercise.kind === 'bodyweight' || !last) return { next: lift, change: 'none' };

  const reps = last.reps;
  const inc = (lift.incrementOverride ?? exercise.increment)[unit];
  const cur = toUnit(result.weightKg, unit); // the weight actually lifted

  if (reps >= SUCCESS_REPS) {
    const doubled = reps >= rules.doubleAt;
    const target = cur + (doubled ? 2 * inc : inc);
    const weightKg = roundForExercise(toKg(target, unit), exercise, 'ceil', inv, unit);
    return { next: { ...lift, weightKg, fails: 0 }, change: doubled ? 'double' : 'up' };
  }

  const fails = lift.fails + 1;
  if (fails >= rules.failsBeforeDeload + 1) {
    const weightKg = roundForExercise(toKg(cur * (1 - rules.deloadPct), unit), exercise, 'floor', inv, unit);
    return { next: { ...lift, weightKg, fails: 0 }, change: 'deload' };
  }
  return { next: { ...lift, weightKg: result.weightKg, fails }, change: 'same' };
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
  if (exercise.kind !== 'barbell' || scheme === '2xAMRAP') return [];
  const barKg = toKg(unit === 'kg' ? inv.barKg : inv.barLb, unit);
  const plan: { reps: number; pct: number | null }[] =
    scheme === '1x5+'
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
