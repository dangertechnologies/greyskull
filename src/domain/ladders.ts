import data from '../catalog/ladders.json';
import type { Ladder, LiftState } from './types';

/** Built-in progression ladders (calisthenics steps from easiest to hardest). */
export const LADDERS = data as Ladder[];

const byId = new Map(LADDERS.map((l) => [l.id, l]));

export const getLadder = (id: string): Ladder | undefined => byId.get(id);

/** A stored step made whole and kept inside the ladder; a value that is not a number starts at the first step. */
export function stepIn(ladder: Ladder, step: number | undefined): number {
  const whole = step !== undefined && Number.isFinite(step) ? Math.trunc(step) : 0;
  return Math.max(0, Math.min(ladder.steps.length - 1, whole));
}

/**
 * A ladder lift moved to another step, the one way every path changes a step (choosing one, climbing, easing
 * back): the step made whole and kept inside the ladder, the rep target back to the bottom of the new step's range,
 * and the heaviest band (bands are listed heaviest first) on a banded step, no band otherwise.
 */
export function stepTransition(
  lift: LiftState,
  to: number,
  ladder: Ladder,
  bands: readonly { id: string }[],
): LiftState {
  const { reps: _reps, bandId: _bandId, ...rest } = lift;
  const step = stepIn(ladder, to);
  return { ...rest, step, ...(ladder.steps[step].band && bands[0] ? { bandId: bands[0].id } : {}) };
}
