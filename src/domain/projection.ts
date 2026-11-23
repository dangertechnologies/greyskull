import { startingWeightKg } from './plates';
import { parseScheme, sessionFor, setTargets } from './program';
import { fiveThreeOneSets, nextLift, SUCCESS_REPS, sessionWeightKg } from './progression';
import type { AppState, LiftState, Scheme, SetResult } from './types';

export interface ProjectedSession {
  n: number;
  dayName: string;
  lifts: { exercise: string; scheme: Scheme; weightKg: number }[];
}

/**
 * Simulate `count` plain-success sessions of one program (light/medium days at their reduced weight) from its
 * position; the draft is ignored. `n` numbers the projected sessions from `state.nextSession` (a list key only).
 */
export function project(state: AppState, programId: string, count: number): ProjectedSession[] {
  const program = state.programs.find((p) => p.id === programId);
  if (!program) return [];
  const unit = state.unit;
  const lifts: Record<string, LiftState> = { ...program.lifts };
  const out: ProjectedSession[] = [];
  for (let i = 0; i < count; i++) {
    const n = state.nextSession + i;
    const session = sessionFor({ ...program, position: program.position + i }, lifts);
    const projected = session.slots.map((slot) => {
      const { exercise: id, lift: key, scheme, progression, week, advanceAt } = slot;
      const exercise = state.exercises[id];
      if (!exercise) return { exercise: id, scheme, weightKg: 0 };
      const start = startingWeightKg(exercise, state.inventory, unit);
      const lift = lifts[key] ?? { weightKg: start, startKg: start, fails: 0 };
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
        bands: state.bands,
      }).next;
      return { exercise: id, scheme, weightKg };
    });
    out.push({ n, dayName: session.dayName, lifts: projected });
  }
  return out;
}
