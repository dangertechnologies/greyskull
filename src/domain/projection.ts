import { parseScheme, sessionFor, setTargets } from './program';
import { fiveThreeOneSets, nextLift, SUCCESS_REPS, sessionWeightKg } from './progression';
import type { AppState, LiftState, Scheme, SetResult } from './types';
import { toKg } from './units';

export interface ProjectedSession {
  n: number;
  dayName: string;
  lifts: { exercise: string; scheme: Scheme; weightKg: number }[];
}

/** Simulate `count` plain-success sessions (light/medium days at their reduced weight) from `state.nextSession` (the draft is ignored). */
export function project(state: AppState, count: number): ProjectedSession[] {
  const { program } = state;
  if (!program) return [];
  const unit = state.unit;
  const barKg = toKg(unit === 'kg' ? state.inventory.barKg : state.inventory.barLb, unit);
  const lifts: Record<string, LiftState> = { ...state.lifts };
  const out: ProjectedSession[] = [];
  for (let i = 0; i < count; i++) {
    const n = state.nextSession + i;
    const session = sessionFor(program, n, lifts);
    const projected = session.slots.map((slot) => {
      const { exercise: id, lift: key, scheme, progression, week, advanceAt } = slot;
      const exercise = state.exercises[id];
      if (!exercise || exercise.kind === 'bodyweight') return { exercise: id, scheme, weightKg: 0 };
      const lift = lifts[key] ?? { weightKg: barKg, startKg: barKg, fails: 0 };
      let weightKg = sessionWeightKg(lift.weightKg, session.intensity, exercise, state.inventory, unit);
      // A plain success reaches each target, including the slot's AMRAP threshold.
      const sets: SetResult[] =
        progression === '531'
          ? fiveThreeOneSets(lift.weightKg, week ?? 0, exercise, state.inventory, unit).map((s) => ({
              ...s,
              reps: s.target ?? (week === 2 ? 1 : week === 1 ? 3 : 5),
            }))
          : setTargets(scheme, lift.reps).map((target) => ({
              target,
              reps: target ?? Math.max(advanceAt ?? 0, parseScheme(scheme).reps ?? SUCCESS_REPS),
            }));
      if (progression === '531') weightKg = Math.max(...sets.map((s) => s.kg ?? 0));
      lifts[key] = nextLift(lift, { weightKg, sets }, program.rules, exercise, state.inventory, unit, {
        ...slot,
        intensity: session.intensity,
      }).next;
      return { exercise: id, scheme, weightKg };
    });
    out.push({ n, dayName: session.dayName, lifts: projected });
  }
  return out;
}
