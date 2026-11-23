import data from '../catalog/ladders.json';
import type { Ladder } from './types';

/** Built-in progression ladders (calisthenics steps from easiest to hardest). */
export const LADDERS = data as Ladder[];

const byId = new Map(LADDERS.map((l) => [l.id, l]));

export const getLadder = (id: string): Ladder | undefined => byId.get(id);

/** A stored step made whole and kept inside the ladder; a value that is not a number starts at the first step. */
export function stepIn(ladder: Ladder, step: number | undefined): number {
  const whole = step !== undefined && Number.isFinite(step) ? Math.trunc(step) : 0;
  return Math.max(0, Math.min(ladder.steps.length - 1, whole));
}
