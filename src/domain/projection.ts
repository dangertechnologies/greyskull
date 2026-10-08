import { nextLift } from './progression';
import { sessionFor } from './program';
import type { AppState, LiftState, Scheme } from './types';
import { toKg } from './units';

export interface ProjectedSession {
  n: number;
  dayName: string;
  lifts: { exercise: string; scheme: Scheme; weightKg: number }[];
}

/** Simulate `count` plain-success sessions from `state.nextSession` (the draft is ignored). */
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
      const result = { weightKg: lift.weightKg, sets: [{ target: null, reps: 5 }] };
      lifts[id] = nextLift(lift, result, program.rules, exercise, state.inventory, unit).next;
      return { exercise: id, scheme, weightKg: lift.weightKg };
    });
    out.push({ n, dayName: session.dayName, lifts: projected });
  }
  return out;
}
