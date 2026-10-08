import { sessionFor, setTargets } from './program';
import { nextLift, SUCCESS_REPS, sessionWeightKg } from './progression';
import type { AppState, LiftState, Scheme } from './types';
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
    const session = sessionFor(program, n);
    const projected = session.slots.map(({ exercise: id, scheme }) => {
      const exercise = state.exercises[id];
      if (!exercise || exercise.kind === 'bodyweight') return { exercise: id, scheme, weightKg: 0 };
      const lift = lifts[id] ?? { weightKg: barKg, startKg: barKg, fails: 0 };
      const weightKg = sessionWeightKg(lift.weightKg, session.intensity, exercise, state.inventory, unit);
      // A plain success: every set hits its target, AMRAP sets exactly SUCCESS_REPS.
      const sets = setTargets(scheme, lift.reps).map((target) => ({ target, reps: target ?? SUCCESS_REPS }));
      lifts[id] = nextLift(lift, { weightKg, sets }, program.rules, exercise, state.inventory, unit, {
        scheme,
        intensity: session.intensity,
      }).next;
      return { exercise: id, scheme, weightKg };
    });
    out.push({ n, dayName: session.dayName, lifts: projected });
  }
  return out;
}
