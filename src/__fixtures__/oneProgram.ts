import type { ActiveProgram, LiftState, Program, SessionLog } from '../domain';
import { useStore } from '../store';

/**
 * Test helpers for the common case of one program: they act on the first program in the store.
 */
const get = () => useStore.getState();

export function program(): ActiveProgram {
  const p = get().programs[0];
  if (!p) throw new Error('No program');
  return p;
}
export const programId = (): string => program().id;
export const lifts = (): Record<string, LiftState> => get().programs[0]?.lifts ?? {};

/** Choose a plan the way the setup screens do: replace the program (same plan keeps its lifts and day) or add one. */
export function setProgram(p: Program): string {
  const current = get().programs[0];
  if (current) {
    get().updateProgram(current.id, p);
    return current.id;
  }
  return get().addProgram({ ...p, name: 'Test program' });
}
export const setLift = (key: string, patch: Partial<LiftState>): void =>
  get().setLift(programId(), key, patch);
export const startSession = (): SessionLog => get().startSession(programId());
export const skipSession = (): void => get().skipSession(programId());
export const undoSkip = (): void => get().undoSkip(programId());
/** Jump the program to `position` (the session of its rotation the next workout is). */
export function setPosition(position: number): void {
  useStore.setState((s) => ({ programs: s.programs.map((p, i) => (i === 0 ? { ...p, position } : p)) }));
}

/** A program for pure domain functions (`sessionFor`, `weekLabel`) at `position`. */
export const active = (
  p: Program,
  position = 0,
  liftStates: Record<string, LiftState> = {},
): ActiveProgram => ({
  ...(JSON.parse(JSON.stringify(p)) as Program),
  id: 'test',
  name: 'Test program',
  position,
  lifts: liftStates,
});
